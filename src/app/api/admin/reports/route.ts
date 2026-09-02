// GET /api/admin/reports?period=ThisWeek|ThisMonth — SO-6, BR-REPORT-1..4. Owner-only. Thin
// wrapper over `reporting.getAppointmentSummary(period)`.
//
// JUDGMENT CALL: the `period` query value is passed straight through as `reporting`'s own
// `ReportPeriod` literals (`"ThisWeek"` / `"ThisMonth"`, types.ts) rather than translated
// from some other wire format (e.g. kebab-case) — no earlier-stage artifact specifies a wire
// format, and passing the module's own literal values through directly (same approach the
// `POST /api/bookings` route takes with `PetSize`, Step 12) keeps this route from inventing
// a mapping layer the module doesn't otherwise need. An unrecognized value is rejected by
// `reporting.getAppointmentSummary` itself (`InvalidReportPeriodError` -> 400, BR-REPORT-1).

import type { NextRequest } from "next/server";
import type { ReportPeriod } from "@/modules/reporting";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

export async function GET(request: NextRequest) {
  try {
    await requireOwnerSession();

    const period = request.nextUrl.searchParams.get("period");
    if (!period) {
      throw new HttpError(400, 'period is required (must be "ThisWeek" or "ThisMonth")');
    }

    const { reporting } = getServices();
    const summary = await reporting.getAppointmentSummary(period as ReportPeriod);

    return jsonOk({ summary });
  } catch (err) {
    return errorToResponse(err);
  }
}
