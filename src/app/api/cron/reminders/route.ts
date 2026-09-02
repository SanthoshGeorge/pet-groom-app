/**
 * POST /api/cron/reminders
 *
 * Auth: shared-secret header, `Authorization: Bearer <CRON_SECRET>` — no session cookie.
 *   Set automatically by Vercel Cron when CRON_SECRET is configured (see vercel.json).
 * Body: none.
 * Response: 200 { result: { processed, sent, failedCount } }.
 * Errors: 401 missing/mismatched header, or CRON_SECRET unconfigured server-side.
 */
// POST /api/cron/reminders — the daily reminder batch job (Flow 3 of
// notification-business-logic-model.md, BR-NOTIF-1/3/4), triggered by Vercel Cron per
// deployment-architecture.md ("Vercel Cron --shared-secret header--> Next.js app's reminder
// API route", env var table: `CRON_SECRET` — "Shared secret checked by the reminder job's
// API route (NFR Design Q7)"). Machine-to-machine only: no session cookie, no
// `requireOwnerSession` — auth is entirely the shared-secret header check below.
//
// JUDGMENT CALL — header name: neither `deployment-architecture.md` nor
// `infrastructure-design.md` names the literal header, only "shared-secret header". This
// route checks `Authorization: Bearer <CRON_SECRET>`, matching Vercel Cron's own actual
// documented behavior (when a `CRON_SECRET` environment variable is set, Vercel
// automatically sends that exact header on every Cron Jobs invocation) — so a vercel.json
// cron entry (Step 28) needs no extra configuration to satisfy this check; it happens for
// free. A request missing the header, or with a mismatched/empty secret, is rejected 401
// with no further detail (never reveals whether `CRON_SECRET` itself is configured).
//
// Response shape: `{ result: ReminderBatchResult }` (`{ processed, sent, failedCount }`,
// notification/types.ts) — documented, no earlier-stage artifact specifies a wire format for
// this route since it has no human caller.

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk } from "@/server/http";

function requireCronSecret(request: Request): void {
  const configured = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  const expected = configured ? `Bearer ${configured}` : null;

  if (!configured || !provided || provided !== expected) {
    throw new HttpError(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    requireCronSecret(request);

    const { notification } = getServices();
    const result = await notification.runDailyReminderBatch();

    return jsonOk({ result });
  } catch (err) {
    return errorToResponse(err);
  }
}
