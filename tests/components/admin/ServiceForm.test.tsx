// @vitest-environment jsdom
//
// Code Generation Step 24 — form-validation component tests for `ServiceForm`
// (src/app/(admin)/admin/services/ServiceForm.tsx), the shared add/edit service form.
// Exercises BR-CAT-5 ("Service name/price/duration are required on creation" —
// business-rules.md) as implemented by the component's own client-side `handleSubmit`
// validation, which requires all three fields AND that price/duration are positive numbers
// (a stricter, UX-focused superset of BR-CAT-5's bare "required" wording — the server
// (`catalog`'s `validateServiceCreateInput`, already covered by Steps 10/15) is the real
// enforcement point regardless; this file only tests what the component itself decides to
// show the admin before ever calling the API).
//
// `../../_lib/api`'s `createService`/`updateService` are mocked so these tests exercise
// only ServiceForm's own validation/rendering logic, not network behavior (already covered
// by Step 15's API route tests).
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceForm } from "@/app/(admin)/admin/services/ServiceForm";
import * as api from "@/app/(admin)/_lib/api";

vi.mock("@/app/(admin)/_lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/(admin)/_lib/api")>();
  return {
    ...actual,
    createService: vi.fn(),
    updateService: vi.fn(),
  };
});

describe("ServiceForm — form validation (BR-CAT-5)", () => {
  beforeEach(() => {
    vi.mocked(api.createService).mockReset();
    vi.mocked(api.updateService).mockReset();
  });

  it("rejects submission with all three fields empty, showing a name-required error and never calling the API", async () => {
    const onSaved = vi.fn();
    render(<ServiceForm onSaved={onSaved} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    expect(await screen.findByTestId("service-form-error")).toHaveTextContent("Name is required.");
    expect(api.createService).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only name (BR-CAT-5: name is required, not just present)", async () => {
    const user = userEvent.setup();
    render(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("service-form-name-input"), "   ");
    await user.type(screen.getByTestId("service-form-price-input"), "50");
    await user.type(screen.getByTestId("service-form-duration-input"), "30");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    expect(await screen.findByTestId("service-form-error")).toHaveTextContent("Name is required.");
    expect(api.createService).not.toHaveBeenCalled();
  });

  it("rejects a zero/non-positive price once name is filled", async () => {
    const user = userEvent.setup();
    render(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("service-form-name-input"), "Full Groom");
    await user.type(screen.getByTestId("service-form-price-input"), "0");
    await user.type(screen.getByTestId("service-form-duration-input"), "60");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    expect(await screen.findByTestId("service-form-error")).toHaveTextContent(
      "Price must be a positive number.",
    );
    expect(api.createService).not.toHaveBeenCalled();
  });

  it("rejects a non-positive duration once name and price are filled", async () => {
    const user = userEvent.setup();
    render(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("service-form-name-input"), "Nail Trim");
    await user.type(screen.getByTestId("service-form-price-input"), "20");
    await user.type(screen.getByTestId("service-form-duration-input"), "-5");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    expect(await screen.findByTestId("service-form-error")).toHaveTextContent(
      "Duration must be a positive number of minutes.",
    );
    expect(api.createService).not.toHaveBeenCalled();
  });

  it("submits with all three fields valid, trims the name, and reports the created service", async () => {
    const user = userEvent.setup();
    const created = {
      id: "svc-1",
      name: "Full Groom",
      price: 75,
      durationMinutes: 90,
      active: true,
    } as unknown as api.Service;
    vi.mocked(api.createService).mockResolvedValue(created);
    const onSaved = vi.fn();

    render(<ServiceForm onSaved={onSaved} onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("service-form-name-input"), "  Full Groom  ");
    await user.type(screen.getByTestId("service-form-price-input"), "75");
    await user.type(screen.getByTestId("service-form-duration-input"), "90");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(created));
    expect(api.createService).toHaveBeenCalledWith({ name: "Full Groom", price: 75, durationMinutes: 90 });
    expect(screen.queryByTestId("service-form-error")).not.toBeInTheDocument();
  });

  it("pre-fills fields and calls updateService (not createService) when editing an existing service", async () => {
    const user = userEvent.setup();
    const existingService = {
      id: "svc-2",
      name: "Bath Only",
      price: 40,
      durationMinutes: 45,
      active: true,
    } as unknown as api.Service;
    const updated = { ...existingService, price: 45 };
    vi.mocked(api.updateService).mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(<ServiceForm existingService={existingService} onSaved={onSaved} onCancel={vi.fn()} />);

    expect(screen.getByTestId("service-form-name-input")).toHaveValue("Bath Only");
    expect(screen.getByTestId("service-form-submit-button")).toHaveTextContent("Save Changes");

    await user.clear(screen.getByTestId("service-form-price-input"));
    await user.type(screen.getByTestId("service-form-price-input"), "45");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
    expect(api.updateService).toHaveBeenCalledWith("svc-2", { name: "Bath Only", price: 45, durationMinutes: 45 });
    expect(api.createService).not.toHaveBeenCalled();
  });

  it("surfaces an ApiError message from the server and does not call onSaved", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createService).mockRejectedValue(new api.ApiError(409, "A service with that name already exists."));
    const onSaved = vi.fn();

    render(<ServiceForm onSaved={onSaved} onCancel={vi.fn()} />);
    await user.type(screen.getByTestId("service-form-name-input"), "Full Groom");
    await user.type(screen.getByTestId("service-form-price-input"), "75");
    await user.type(screen.getByTestId("service-form-duration-input"), "90");
    fireEvent.click(screen.getByTestId("service-form-submit-button"));

    expect(await screen.findByTestId("service-form-error")).toHaveTextContent(
      "A service with that name already exists.",
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("calls onCancel when Cancel is clicked, without validating or submitting", async () => {
    const onCancel = vi.fn();
    render(<ServiceForm onSaved={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByTestId("service-form-cancel-button"));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(api.createService).not.toHaveBeenCalled();
  });
});
