// Admin/owner site route group (calendar, on-behalf booking, catalog/hours/reports) — built
// out in Code Generation Step 22.
//
// OWNER-SESSION GATE: applied once, here, at the layout level (not repeated per-page) —
// exactly the "check session in a server component layout" option the Step 22 task allows.
// This is a server component (async, reads the session cookie directly via
// `getCurrentSession`, same helper `src/server/session.ts` exports for every admin API
// route's own `requireOwnerSession`) rather than a client-side 401-redirect: a server
// component can redirect *before* any admin markup/data ever reaches the browser, which is a
// strictly tighter gate than the public site's client-side "check /api/account/pets, branch
// on 200/401" convention (`HeaderAuthLinks`) — appropriate here since every page under this
// route group is owner-only, not just visually different for a logged-out visitor.
// `getCurrentSession()` (not `requireOwnerSession()`) is used directly rather than
// try/catching `requireOwnerSession`'s thrown `HttpError` — there's no HTTP response to
// shape here, just a redirect decision, so reading the two failure cases (`null` session /
// wrong role) directly and calling `redirect()` is the simpler, equivalent check.
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/server/session";
import { AdminShell } from "./_components/AdminShell";
import "./admin-tokens.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session || session.identity.role !== "owner") {
    redirect("/login?redirectTo=/admin/calendar");
  }

  return <AdminShell>{children}</AdminShell>;
}
