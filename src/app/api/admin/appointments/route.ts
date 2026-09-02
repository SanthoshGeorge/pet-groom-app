/**
 * GET /api/admin/appointments?start=<ISO date>&end=<ISO date>
 *
 * Auth: session cookie required, role=owner (401/403 otherwise).
 * Query: start, end — both required (no unbounded "list everything" mode).
 * Response: 200 { appointments }.
 * Errors: 400 missing/invalid start or end, 401 no session, 403 non-owner session.
 */
// GET /api/admin/appointments?start=<ISO date>&end=<ISO date> — SO-1's admin calendar,
// owner-only. Thin wrapper over `booking.listAllBookings({ start, end })` (Flow 6 of
// booking-business-logic-model.md).
//
// JUDGMENT CALL: `start`/`end` query params (same names/shape as the public
// `GET /api/availability` route, Step 12) are both required, not optional — per
// nfr-design-patterns.md's Scalability Patterns note that `listAllBookings` relies on its
// caller always supplying a bounded `dateRange` rather than the service adding pagination
// (see that file's comment on `listAllBookings`/`listMyBookings`). There is no "list every
// appointment ever" mode on this route; the admin calendar is expected to always query a
// specific range (e.g. "this week").

import type { NextRequest } from "next/server";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

function parseDateParam(value: string | null, label: string): Date {
  if (!value) {
    throw new HttpError(400, `${label} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date`);
  }
  return date;
}

export async function GET(request: NextRequest) {
  try {
    await requireOwnerSession();

    const { searchParams } = request.nextUrl;
    const start = parseDateParam(searchParams.get("start"), "start");
    const end = parseDateParam(searchParams.get("end"), "end");

    const { booking } = getServices();
    const appointments = await booking.listAllBookings({ start, end });

    return jsonOk({ appointments });
  } catch (err) {
    return errorToResponse(err);
  }
}
