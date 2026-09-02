// booking module (BookingService) — Code Generation Phase B, Step 7.
// Implements BR-BOOK-1..11 (booking-business-rules.md), the Appointment/AppointmentLineItem
// status lifecycle (booking-domain-entities.md), and `markNoShow` (added per Q2=A) — all 7
// flows from booking-business-logic-model.md.

export type {
  Appointment,
  AppointmentLineItem,
  AppointmentStatus,
  AppointmentWithLineItems,
  BookingActor,
  CreateBookingInput,
  DateRange,
  LookupContactInfo,
  OwnerReference,
  PetSelection,
  PetServicePair,
} from "./types";
export {
  AppointmentNotEligibleForNoShowError,
  AppointmentNotFoundError,
  AppointmentNotModifiableError,
  BookingLookupNotFoundError,
  BookingReferenceCollisionError,
  BookingValidationError,
  InvalidPetReferenceError,
  NoGroomerAvailableError,
  SlotNotAvailableError,
  UnbookableServiceError,
} from "./errors";
export type {
  BookingRepository,
  CreateAppointmentInput,
  CreateAppointmentLineItemInput,
  UpdateStatusInput,
} from "./repository";
export { createBookingService } from "./service";
export type { BookingService, BookingServiceDependencies, NotificationCollaborator } from "./service";
export { computeEffectiveStatus } from "./status";
export { generateBookingReference } from "./reference";
