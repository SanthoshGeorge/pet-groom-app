"use client";

// Shared admin nav/shell — sidebar linking every admin screen plus a logout action, per the
// Step 22 task's "A shared admin nav/shell in `src/app/(admin)/layout.tsx`... plus a logout
// action" instruction. Rendered by `layout.tsx` (a server component, which does the
// owner-session gate) around `{children}`; this piece is `"use client"` only for
// `usePathname` (active-nav highlighting) and the logout button's click handler — the gate
// itself lives one level up, not here, so this component never needs to re-check the session.
//
// Sidebar item order/icons/labels match both mockups' identical sidebar exactly: Calendar,
// Services & Prices, Working Hours, Reports, then a Log out item pinned to the bottom below a
// divider. "New Booking" is deliberately NOT a sidebar item — in both mockups it's the
// Calendar page's own primary button, not a nav link (see `calendar/AdminCalendarPage.tsx`).
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "../_lib/api";
import { CalendarIcon, HoursIcon, LogoutIcon, PawLogoIcon, ReportsIcon, ServicesIcon } from "./icons";
import styles from "./AdminShell.module.css";

const NAV_ITEMS = [
  { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon, testId: "admin-nav-calendar-link" },
  { href: "/admin/services", label: "Services & Prices", icon: ServicesIcon, testId: "admin-nav-services-link" },
  { href: "/admin/hours", label: "Working Hours", icon: HoursIcon, testId: "admin-nav-hours-link" },
  { href: "/admin/reports", label: "Reports", icon: ReportsIcon, testId: "admin-nav-reports-link" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // logout is idempotent server-side — a network failure still means "treat as logged
      // out" client-side, same convention `(public)/_components/HeaderAuthLinks.tsx` uses.
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <PawLogoIcon />
          <span className={styles.brandName}>Happy Tails</span>
        </div>

        <nav>
          {NAV_ITEMS.map(({ href, label, icon: Icon, testId }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={active ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
                data-testid={testId}
                aria-current={active ? "page" : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            type="button"
            className={styles.logoutItem}
            onClick={handleLogout}
            disabled={loggingOut}
            data-testid="admin-nav-logout-button"
          >
            <LogoutIcon />
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      </aside>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
