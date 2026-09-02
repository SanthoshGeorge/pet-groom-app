// PATCH /api/bookings/:id — GC-3/RC-3 self-service cancel/reschedule, plus (owner session)
// SO-1's "cancel any appointment". Body: `{ action: "cancel" }` or
// `{ action: "reschedule", slotStart: string }`. BR-BOOK-3/6/9/10.
//
// JUDGMENT CALL — authorization: no earlier-stage artifact specifies exactly how a caller
// *proves* it may act on a given appointment id from this public (non-session-required)
// route. Three paths, tried in this order:
//
//   1. A valid `role=owner` session (the shop owner) may act on ANY appointment — SO-1's
//      admin capability. The Code Generation plan's Step 13 scope list doesn't include a
//      separate admin cancel/reschedule route, so this route is where that capability is
//      expected to live: same `booking.cancelBooking`/`rescheduleBooking` calls, just with
//      `actor = "owner"` and no ownership check.
//   2. A valid `role=customer` session may act on an appointment only if it belongs to
//      their own linked Owner — checked via `booking.listMyBookings(ownerId)` (the only
//      service method that scopes appointments to an Owner), not by trusting the path
//      param alone. `actor = "account"`.
//   3. No session, or a session that doesn't own this appointment: the request body must
//      also supply `bookingReference` + `contact`, verified through the SAME
//      `booking.lookupBooking` BR-BOOK-5 mechanism the guest-lookup route uses, and the
//      looked-up appointment's id must match the path param. `actor = "guest"`. This
//      reuses BR-BOOK-5's exact generic-error guarantee rather than inventing a second,
//      parallel ownership check with its own leak surface.
//
// A request satisfying none of the three gets a 401.

import type { BookingActor, LookupContactInfo } from "@/modules/booking";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";
import { getCurrentSession } from "@/server/session";

interface PatchRequestBody {
  action: "cancel" | "reschedule";
  slotStart?: string;
  bookingReference?: string;
  contact?: LookupContactInfo;
}

async function resolveActor(appointmentId: string, body: PatchRequestBody): Promise<BookingActor> {
  const { booking } = getServices();
  const session = await getCurrentSession();

  if (session && session.identity.role === "owner") {
    return "owner";
  }

  if (session && session.identity.role === "customer" && session.identity.ownerId) {
    const mine = await booking.listMyBookings(session.identity.ownerId);
    if (mine.some((appointment) => appointment.id === appointmentId)) {
      return "account";
    }
    // Falls through to the guest-proof path below rather than 403ing here — a logged-in
    // customer poking at someone else's id should see the same outcome an anonymous caller
    // would (BR-BOOK-5's generic pattern), not a distinct "exists, but not yours" signal.
  }

  if (!body.bookingReference || !body.contact) {
    throw new HttpError(401, "Log in, or supply bookingReference and contact, to modify this booking");
  }
  const found = await booking.lookupBooking(body.bookingReference, body.contact);
  if (found.id !== appointmentId) {
    // Same generic message the lookup route itself gives for any real mismatch (BR-BOOK-5).
    throw new HttpError(404, "No booking found matching that reference and contact information");
  }
  return "guest";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await readJsonBody<PatchRequestBody>(request);

    if (body.action !== "cancel" && body.action !== "reschedule") {
      throw new HttpError(400, 'action must be "cancel" or "reschedule"');
    }

    const actor = await resolveActor(id, body);
    const { booking } = getServices();

    if (body.action === "cancel") {
      const appointment = await booking.cancelBooking(id, actor);
      return jsonOk({ appointment });
    }

    if (!body.slotStart || Number.isNaN(new Date(body.slotStart).getTime())) {
      throw new HttpError(400, "a valid slotStart is required to reschedule");
    }
    const appointment = await booking.rescheduleBooking(id, new Date(body.slotStart));
    return jsonOk({ appointment });
  } catch (err) {
    return errorToResponse(err);
  }
}
