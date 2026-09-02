// POST /api/admin/hours — SO-5, setting the shop's regular weekly working hours
// (Flow 5 of availability-business-logic-model.md). Owner-only. BR-AVAIL-7 (exactly one
// rule per day, all 7 required) is enforced by `availability.setWorkingHours` itself
// (`AvailabilityValidationError` -> 400); this route only checks the body is shaped like an
// array before handing off.
//
// BR-AVAIL-9 follow-up: `setWorkingHours` only *identifies* appointments the new hours no
// longer cover (`affectedAppointmentIds`) — per availability's own docs, actually flagging
// them is `booking`'s job. This route is the caller that wires the two modules together, as
// `availability-business-logic-model.md`'s Cross-Module Notes anticipate ("a future admin
// route... is expected to pass these ids to `booking`'s `flagAppointmentsForReview`").

import type { WorkingHoursRuleInput } from "@/modules/availability";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

interface SetHoursRequestBody {
  schedule?: WorkingHoursRuleInput[];
}

export async function POST(request: Request) {
  try {
    await requireOwnerSession();

    const body = await readJsonBody<SetHoursRequestBody>(request);
    if (!Array.isArray(body.schedule) || body.schedule.length === 0) {
      throw new HttpError(400, "schedule must be a non-empty array of WorkingHoursRule entries");
    }

    const { availability, booking } = getServices();
    const { workingHours, affectedAppointmentIds } = await availability.setWorkingHours(body.schedule);

    await booking.flagAppointmentsForReview(affectedAppointmentIds); // BR-AVAIL-9

    return jsonOk({ workingHours, affectedAppointmentIds });
  } catch (err) {
    return errorToResponse(err);
  }
}
