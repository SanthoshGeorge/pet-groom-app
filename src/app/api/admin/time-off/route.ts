// POST /api/admin/time-off — SO-5, adding a time-off block (Flow 6 of
// availability-business-logic-model.md). Owner-only. BR-AVAIL-8 (whole calendar days only)
// is enforced by `availability.addTimeOff` itself (`AvailabilityValidationError` -> 400);
// this route only parses the dates before handing off.
//
// Same BR-AVAIL-9 follow-up as `POST /api/admin/hours`: `addTimeOff` only identifies
// affected appointment ids, this route passes them to `booking.flagAppointmentsForReview`.
//
// Request body shape (documented — no earlier-stage artifact specifies a wire format):
//   { startDate: string (ISO date), endDate: string (ISO date), reason?: string | null }

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, readJsonBody } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

interface AddTimeOffRequestBody {
  startDate?: string;
  endDate?: string;
  reason?: string | null;
}

function parseDateParam(value: string | undefined, label: string): Date {
  if (!value) {
    throw new HttpError(400, `${label} is required`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date`);
  }
  return date;
}

export async function POST(request: Request) {
  try {
    await requireOwnerSession();

    const body = await readJsonBody<AddTimeOffRequestBody>(request);
    const startDate = parseDateParam(body.startDate, "startDate");
    const endDate = parseDateParam(body.endDate, "endDate");

    const { availability, booking } = getServices();
    const { timeOff, affectedAppointmentIds } = await availability.addTimeOff({
      startDate,
      endDate,
      reason: body.reason ?? null,
    });

    await booking.flagAppointmentsForReview(affectedAppointmentIds); // BR-AVAIL-9

    return jsonCreated({ timeOff, affectedAppointmentIds });
  } catch (err) {
    return errorToResponse(err);
  }
}
