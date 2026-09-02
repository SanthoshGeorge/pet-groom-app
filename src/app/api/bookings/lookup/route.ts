/**
 * POST /api/bookings/lookup
 *
 * Auth: none (public) — proof is knowledge of bookingReference + matching contact info.
 * Body: { bookingReference, contact: { email?, phone? } }.
 * Response: 200 { appointment }.
 * Errors: 400 missing bookingReference/contact, 404 no match — identical response whether
 *   the reference is unknown or the contact doesn't match (BR-BOOK-5).
 */
// POST /api/bookings/lookup — GC-3 guest self-service lookup by reference + contact info.
// BR-BOOK-5.
//
// JUDGMENT CALL: POST only (not GET) — the request carries the caller's contact info
// (email and/or phone), and a GET with that in the query string would land in server/proxy
// access logs and browser history for no benefit; a lookup here isn't meaningfully
// cacheable, so nothing is lost by not also supporting GET.
//
// `booking.lookupBooking` already throws the exact same `BookingLookupNotFoundError`
// (mapped to a generic 404 by src/server/http.ts) whether the reference is unknown or the
// contact info doesn't match (BR-BOOK-5's "same generic error either way") — this route adds
// no extra branching that could reintroduce that distinction.

import type { LookupContactInfo } from "@/modules/booking";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";

interface LookupRequestBody {
  bookingReference: string;
  contact: LookupContactInfo;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<LookupRequestBody>(request);
    if (!body.bookingReference || typeof body.bookingReference !== "string") {
      throw new HttpError(400, "bookingReference is required");
    }
    if (!body.contact || typeof body.contact !== "object") {
      throw new HttpError(400, "contact (email and/or phone) is required");
    }

    const { booking } = getServices();
    const appointment = await booking.lookupBooking(body.bookingReference, body.contact);
    return jsonOk({ appointment });
  } catch (err) {
    return errorToResponse(err);
  }
}
