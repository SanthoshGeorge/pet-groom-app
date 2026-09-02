"use client";

// Login-state awareness for `SiteHeader` (Step 21). Step 20's `SiteHeader` had no concept of
// "logged in" at all (the mockup it was built from didn't show one) — this is new, minimal
// client-side session awareness added for this step, not a full auth-context system: it
// simply calls the existing `GET /api/account/pets` endpoint and reads 200-vs-401 as
// "logged in as a customer" vs "not," the same signal `/account/pets` itself uses for its
// own redirect-to-login gate. (A `role=owner` session also reads as "guest" here, since that
// endpoint's `requireOwnerId` 401s for any non-customer role too — harmless, since the shop
// owner uses the separate `(admin)` site, not this public header.)
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchAccountPets, logout } from "../_lib/api";
import styles from "./SiteHeader.module.css";

type SessionStatus = "loading" | "guest" | "customer";

export function HeaderAuthLinks() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAccountPets()
      .then(() => {
        if (!cancelled) setStatus("customer");
      })
      .catch(() => {
        // Any failure (401 "not logged in," or a network error) — the header degrades to the
        // logged-out state rather than blocking or erroring; this is a convenience affordance,
        // not the real auth gate (each protected page/route enforces that itself).
        if (!cancelled) setStatus("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // logout is idempotent server-side (src/app/api/auth/logout/route.ts) — a network
      // failure here still means the client should show the logged-out state.
    } finally {
      setLoggingOut(false);
      setStatus("guest");
      router.push("/");
      router.refresh();
    }
  }

  if (status === "loading") {
    // No visible placeholder — avoids a flash of "Log In" for an already-logged-in visitor.
    return null;
  }

  if (status === "guest") {
    return (
      <Link href="/login" className={styles.navLink} data-testid="site-header-login-link">
        Log In
      </Link>
    );
  }

  return (
    <span className={styles.accountLinks}>
      <Link href="/account/pets" className={styles.navLink} data-testid="site-header-account-link">
        My Account
      </Link>
      <button
        type="button"
        className={styles.navButton}
        onClick={handleLogout}
        disabled={loggingOut}
        data-testid="site-header-logout-button"
      >
        {loggingOut ? "Logging out…" : "Log Out"}
      </button>
    </span>
  );
}
