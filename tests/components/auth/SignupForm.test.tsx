// @vitest-environment jsdom
//
// Code Generation Step 24 — form-validation component tests for `SignupForm`
// (src/app/(public)/(marketing)/signup/SignupForm.tsx). Its own header comment documents
// the client-side password-length check as "a client-side mirror of auth/validation.ts's
// `validatePassword`" (BR-AUTH-* territory, already covered server-side by Steps 10/15) —
// these tests confirm the mirror actually blocks submission with the right message, in the
// order the component checks fields (name -> phone -> email format -> password length ->
// password match).
//
// `next/navigation`'s `useRouter` and `../../_lib/api`'s `registerAccount` are both mocked.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupForm } from "@/app/(public)/(marketing)/signup/SignupForm";
import * as api from "@/app/(public)/_lib/api";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/app/(public)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(public)/_lib/api")>();
  return {
    ...actual,
    registerAccount: vi.fn(),
  };
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByTestId("signup-form-name-input"), "Jamie Rivera");
  await user.type(screen.getByTestId("signup-form-phone-input"), "555-019-4482");
  await user.type(screen.getByTestId("signup-form-email-input"), "jamie@example.com");
  await user.type(screen.getByTestId("signup-form-password-input"), "supersecret");
  await user.type(screen.getByTestId("signup-form-confirm-password-input"), "supersecret");
}

describe("SignupForm — form validation", () => {
  beforeEach(() => {
    vi.mocked(api.registerAccount).mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("rejects an empty submission with a name-required error", async () => {
    render(<SignupForm />);
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent("Enter your name.");
    expect(api.registerAccount).not.toHaveBeenCalled();
  });

  it("requires a phone number once name is filled", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByTestId("signup-form-name-input"), "Jamie Rivera");
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent("Enter your phone number.");
  });

  it("rejects a malformed email address", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByTestId("signup-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("signup-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("signup-form-email-input"), "not-an-email");
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent("Enter a valid email address.");
    expect(api.registerAccount).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByTestId("signup-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("signup-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("signup-form-email-input"), "jamie@example.com");
    await user.type(screen.getByTestId("signup-form-password-input"), "short1");
    await user.type(screen.getByTestId("signup-form-confirm-password-input"), "short1");
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent(
      "Password must be at least 8 characters.",
    );
    expect(api.registerAccount).not.toHaveBeenCalled();
  });

  it("rejects mismatched password/confirm-password", async () => {
    const user = userEvent.setup();
    render(<SignupForm />);
    await user.type(screen.getByTestId("signup-form-name-input"), "Jamie Rivera");
    await user.type(screen.getByTestId("signup-form-phone-input"), "555-019-4482");
    await user.type(screen.getByTestId("signup-form-email-input"), "jamie@example.com");
    await user.type(screen.getByTestId("signup-form-password-input"), "supersecret");
    await user.type(screen.getByTestId("signup-form-confirm-password-input"), "different1");
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent("Passwords don't match.");
    expect(api.registerAccount).not.toHaveBeenCalled();
  });

  it("submits with everything valid, registers the account, and redirects to /account/pets", async () => {
    const user = userEvent.setup();
    vi.mocked(api.registerAccount).mockResolvedValue({ id: "owner-1", email: "jamie@example.com" } as never);

    render(<SignupForm />);
    await fillValidForm(user);
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/account/pets"));
    expect(api.registerAccount).toHaveBeenCalledWith({
      email: "jamie@example.com",
      password: "supersecret",
      name: "Jamie Rivera",
      phone: "555-019-4482",
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("surfaces a server ApiError (e.g. email already used) without redirecting", async () => {
    const user = userEvent.setup();
    vi.mocked(api.registerAccount).mockRejectedValue(new api.ApiError(409, "That email is already registered."));

    render(<SignupForm />);
    await fillValidForm(user);
    fireEvent.click(screen.getByTestId("signup-form-submit-button"));

    expect(await screen.findByTestId("signup-form-error")).toHaveTextContent("That email is already registered.");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("pre-fills fields from the prefill prop (post-guest-booking signup CTA)", () => {
    render(<SignupForm prefill={{ name: "Jamie Rivera", phone: "555-019-4482", email: "jamie@example.com" }} />);

    expect(screen.getByTestId("signup-form-name-input")).toHaveValue("Jamie Rivera");
    expect(screen.getByTestId("signup-form-phone-input")).toHaveValue("555-019-4482");
    expect(screen.getByTestId("signup-form-email-input")).toHaveValue("jamie@example.com");
  });
});
