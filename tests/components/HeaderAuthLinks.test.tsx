// @vitest-environment jsdom
//
// Code Generation Step 24 — state-transition component tests for `HeaderAuthLinks`
// (src/app/(public)/_components/HeaderAuthLinks.tsx): its three-state session machine
// ("loading" -> "guest" | "customer", then "customer" -> "guest" on logout), driven purely
// by whether `fetchAccountPets` (GET /api/account/pets) resolves or rejects — the same
// 200-vs-401 signal the component's own header comment documents.
//
// `../_lib/api` is mocked; `next/navigation`'s `useRouter` is mocked since `handleLogout`
// calls `router.push`/`router.refresh`.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { HeaderAuthLinks } from "@/app/(public)/_components/HeaderAuthLinks";
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
    fetchAccountPets: vi.fn(),
    logout: vi.fn(),
  };
});

describe("HeaderAuthLinks — session-state transitions", () => {
  beforeEach(() => {
    vi.mocked(api.fetchAccountPets).mockReset();
    vi.mocked(api.logout).mockReset();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  it("renders nothing while the session check is in flight (no flash of the logged-out state)", () => {
    vi.mocked(api.fetchAccountPets).mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<HeaderAuthLinks />);

    expect(container).toBeEmptyDOMElement();
  });

  it("transitions to the guest state (Log In link) when fetchAccountPets rejects (401 / not logged in)", async () => {
    vi.mocked(api.fetchAccountPets).mockRejectedValue(new api.ApiError(401, "Not logged in"));
    render(<HeaderAuthLinks />);

    expect(await screen.findByTestId("site-header-login-link")).toHaveTextContent("Log In");
    expect(screen.queryByTestId("site-header-account-link")).not.toBeInTheDocument();
  });

  it("transitions to the guest state on ANY failure, including a plain network error (not just a 401 ApiError)", async () => {
    vi.mocked(api.fetchAccountPets).mockRejectedValue(new Error("network down"));
    render(<HeaderAuthLinks />);

    expect(await screen.findByTestId("site-header-login-link")).toBeInTheDocument();
  });

  it("transitions to the customer state (My Account + Log Out) when fetchAccountPets resolves", async () => {
    vi.mocked(api.fetchAccountPets).mockResolvedValue({ id: "owner-1", pets: [] } as never);
    render(<HeaderAuthLinks />);

    expect(await screen.findByTestId("site-header-account-link")).toHaveTextContent("My Account");
    expect(screen.getByTestId("site-header-logout-button")).toHaveTextContent("Log Out");
    expect(screen.queryByTestId("site-header-login-link")).not.toBeInTheDocument();
  });

  it("logging out transitions the customer state back to guest, redirects home, and refreshes", async () => {
    vi.mocked(api.fetchAccountPets).mockResolvedValue({ id: "owner-1", pets: [] } as never);
    vi.mocked(api.logout).mockResolvedValue(undefined);
    render(<HeaderAuthLinks />);
    const logoutButton = await screen.findByTestId("site-header-logout-button");

    logoutButton.click();

    await waitFor(() => expect(screen.getByTestId("site-header-login-link")).toBeInTheDocument());
    expect(api.logout).toHaveBeenCalledOnce();
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("still transitions to the guest state even if the logout call itself fails (idempotent-logout UX)", async () => {
    vi.mocked(api.fetchAccountPets).mockResolvedValue({ id: "owner-1", pets: [] } as never);
    vi.mocked(api.logout).mockRejectedValue(new Error("network down"));
    render(<HeaderAuthLinks />);
    const logoutButton = await screen.findByTestId("site-header-logout-button");

    logoutButton.click();

    await waitFor(() => expect(screen.getByTestId("site-header-login-link")).toBeInTheDocument());
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
