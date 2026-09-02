// availability module (AvailabilityService) — Code Generation Phase B, Step 6.
// Implements BR-AVAIL-1..11 (availability-business-rules.md) and Flows 1-6
// (availability-business-logic-model.md).

export {
  ADVANCE_BOOKING_DAYS,
  BUFFER_MINUTES,
  SLOT_GRID_MINUTES,
} from "./config";
export type {
  AddTimeOffResult,
  DateRange,
  DayOfWeek,
  ForceClaimResult,
  SetWorkingHoursResult,
  Slot,
  SlotRequest,
  TimeOff,
  TimeOffCreateInput,
  WorkingHoursRule,
  WorkingHoursRuleInput,
} from "./types";
export {
  AvailabilityValidationError,
  ServiceNotFoundError,
  SlotConstraintViolationError,
  SlotNotAvailableError,
} from "./errors";
export type { AvailabilityRepository, ClaimSlotInput, OccupiedRange } from "./repository";
export { createAvailabilityService } from "./service";
export type { AvailabilityService, AvailabilityServiceDependencies } from "./service";
