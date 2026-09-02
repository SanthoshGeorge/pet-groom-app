/**
 * POST /api/admin/appointments/:id/no-show
 *
 * Auth: session cookie required, role=owner (401/403 otherwise).
 * Body: none.
 * Response: 200 { appointment }.
 * Errors: 401 no session, 403 non-owner session, 404 unknown id, 409 appointment not
 *   (effectively) Completed (BR-BOOK-2b).
 */
// POST /api/admin/appointments/:id/no-show — Flow 7 of booking-business-logic-model.md,
// SO-6's data source. Owner-only. No request body — `booking.markNoShow` takes just the
// appointment id, and throws `AppointmentNotEligibleForNoShowError` (BR-BOOK-2b, mapped to
// 409) when the appointment isn't (effectively) `Completed`.

import { getServices } from "@/server/container";
import { errorToResponse, jsonOk } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerSession();
    const { id } = await params;

    const { booking } = getServices();
    const appointment = await booking.markNoShow(id);

    return jsonOk({ appointment });
  } catch (err) {
    return errorToResponse(err);
  }
}
