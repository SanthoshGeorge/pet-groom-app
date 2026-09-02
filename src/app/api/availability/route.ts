/**
 * GET /api/availability?serviceId=<id>&start=<ISO date>&end=<ISO date>
 *
 * Auth: none (public).
 * Query: serviceId, start, end — all required. Computed live, no caching.
 * Response: 200 { slots }.
 * Errors: 400 missing/invalid serviceId, start, or end; 404 unknown/inactive serviceId.
 */
// GET /api/availability?serviceId=<id>&start=<ISO date>&end=<ISO date> — GC-1/RC-1 slot
// browsing (BR-AVAIL-1/3/4/8), computed live with no caching per nfr-design-patterns.md's
// Scalability Patterns. Thin wrapper over `availability.getAvailableSlots(dateRange,
// serviceId)`.
//
// JUDGMENT CALL: query param names (`serviceId`/`start`/`end`) aren't specified by any
// earlier-stage artifact — `getAvailableSlots(dateRange, serviceId)`'s own parameter names
// map directly onto them.

import type { NextRequest } from "next/server";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk } from "@/server/http";

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
    const { searchParams } = request.nextUrl;
    const serviceId = searchParams.get("serviceId");
    if (!serviceId) {
      throw new HttpError(400, "serviceId is required");
    }
    const start = parseDateParam(searchParams.get("start"), "start");
    const end = parseDateParam(searchParams.get("end"), "end");

    const { availability } = getServices();
    const slots = await availability.getAvailableSlots({ start, end }, serviceId);

    return jsonOk({ slots });
  } catch (err) {
    return errorToResponse(err);
  }
}
