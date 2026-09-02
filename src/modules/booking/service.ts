// BookingService business logic — implements BR-BOOK-1..11, the Appointment/
// AppointmentLineItem status lifecycle (booking-domain-entities.md), and all 7 flows from
// booking-business-logic-model.md, including `markNoShow` (added per Q2=A, not present in
// the original component-methods.md — see booking-domain-entities.md's "Status Lifecycle").
// Pure TypeScript: depends only on the BookingRepository abstraction, plus the real
// `CustomerService`/`CatalogService`/`AvailabilityService` (all already built, Steps 4-6)
// and a minimal `NotificationCollaborator` for `notification` (Step 8, built AFTER this
// module — see this file's header note in types.ts for why that one stays a locally-
// defined structural interface, mirroring `auth`'s `OwnerIdentityResolver` pattern).
//
// JUDGMENT CALL (documented, not a silent deviation — see the Code Generation report):
// `createBooking`'s signature here is `createBooking(input: CreateBookingInput)` — a
// single input object, not the positional `(ownerInfo, pets[], serviceId, slot, createdBy)`
// from component-methods.md. booking-domain-entities.md's own Q1=A note already flags that
// the literal signature needs to change for per-pet service selection (`petServicePairs[]`
// instead of one shared `serviceId`); bundling every input into one object here is a
// direct, natural consequence of that already-approved change (a 5+ positional-argument
// function with one of them now itself a structured array is exactly the shape most
// TypeScript codebases pass as a single input object), not a new, unreviewed decision.

import type { AvailabilityService, SlotRequest } from "@/modules/availability";
import { SlotNotAvailableError as AvailabilitySlotNotAvailableError } from "@/modules/availability";
import type { CatalogService } from "@/modules/catalog";
import type { CustomerService, Owner } from "@/modules/customer";
import {
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
import { generateAppointmentId } from "./id";
import { generateBookingReference } from "./reference";
import type { BookingRepository, CreateAppointmentInput, CreateAppointmentLineItemInput } from "./repository";
import { computeEffectiveStatus, withEffectiveStatus, withEffectiveStatusList } from "./status";
import type {
  AppointmentWithLineItems,
  BookingActor,
  CreateBookingInput,
  DateRange,
  LookupContactInfo,
  OwnerReference,
  PetServicePair,
} from "./types";
import { validateCreateBookingInput, validateLookupInput, validateRescheduleInput } from "./validation";

/**
 * The minimal slice of `NotificationService` (Step 8) that `booking` needs — `notification`
 * doesn't exist yet at this build step, so this mirrors `auth`'s `OwnerIdentityResolver`
 * pattern: the real `NotificationService` instance satisfies this structurally once built,
 * no explicit adapter needed. Every call site is fixed by this pass per BR-BOOK-9/10/11;
 * `notification`'s own pass defines HOW each of these actually sends email/SMS.
 */
export interface NotificationCollaborator {
  /** Flow 1/2, BR-BOOK-11 — to the Owner's contact info regardless of `createdBy`/override. */
  sendBookingConfirmation(appointment: AppointmentWithLineItems): Promise<unknown>;
  scheduleReminder(appointment: AppointmentWithLineItems): Promise<unknown>;
  /** Flow 3/4, BR-BOOK-10 — suppresses/re-syncs the day-before reminder. */
  cancelScheduledReminder(appointmentId: string): Promise<unknown>;
  /** Flow 3, BR-BOOK-9 — ALWAYS to the customer on file, regardless of who cancelled. */
  sendCancellationConfirmation(appointment: AppointmentWithLineItems): Promise<unknown>;
}

export interface BookingServiceDependencies {
  repository: BookingRepository;
  customer: CustomerService;
  catalog: CatalogService;
  availability: AvailabilityService;
  notification: NotificationCollaborator;
}

export interface BookingService {
  /** Flow 1 — GC-2, RC-2, SO-2 (same flow, different `createdBy`). BR-BOOK-1/8/9. */
  createBooking(input: CreateBookingInput): Promise<AppointmentWithLineItems>;
  /** Flow 2 — SO-3, owner-only (route-level `role=owner` gating is the API layer's job, per nfr-design-patterns.md's Security Patterns). BR-AVAIL-10, BR-BOOK-11. */
  createOverrideBooking(input: CreateBookingInput): Promise<AppointmentWithLineItems>;
  /** Flow 5 — GC-3 guest self-service lookup. BR-BOOK-5. Same generic error whether the reference or the contact info was wrong. */
  lookupBooking(bookingReference: string, contact: LookupContactInfo): Promise<AppointmentWithLineItems>;
  /** Flow 6 — RC-3. Takes the resolved Owner id directly (see this method's implementation note on why, not the literal `accountId` from component-methods.md). */
  listMyBookings(ownerId: string): Promise<AppointmentWithLineItems[]>;
  /** Flow 6 — SO-1 admin calendar, owner-only (route-level gating, as above). */
  listAllBookings(range: DateRange): Promise<AppointmentWithLineItems[]>;
  /** Flow 3 — GC-3, RC-3, SO-1. BR-BOOK-6, BR-BOOK-9. */
  cancelBooking(appointmentId: string, actor: BookingActor): Promise<AppointmentWithLineItems>;
  /** Flow 4 — GC-3, RC-3. BR-BOOK-3, BR-BOOK-6, BR-BOOK-10. */
  rescheduleBooking(appointmentId: string, newSlotStart: Date): Promise<AppointmentWithLineItems>;
  /** Flow 7 — SO-6's data source, admin-only, added per Q2=A. BR-BOOK-2b. */
  markNoShow(appointmentId: string): Promise<AppointmentWithLineItems>;
  /**
   * BR-AVAIL-9's flagging mechanism, explicitly delegated to `booking` by that rule (see
   * availability's `SetWorkingHoursResult`/`AddTimeOffResult`) — not one of
   * component-methods.md's original methods; added here, analogous to `markNoShow`, so a
   * future admin route (Step 12/13) has something concrete to call with the appointment
   * ids `availability.setWorkingHours`/`addTimeOff` identify as affected.
   */
  flagAppointmentsForReview(appointmentIds: string[]): Promise<void>;
  /**
   * BR-BOOK-7 — visit notes are editable directly on the appointment. Not tied to a
   * numbered flow, but BR-BOOK-7 has no operational meaning without some way to actually
   * write it; added as a small, minimal method (SO-1's appointment detail view is the
   * expected caller, Step 20-22).
   */
  updateVisitNotes(appointmentId: string, visitNotes: string | null): Promise<AppointmentWithLineItems>;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** BR-BOOK-5 — email compared case-insensitively, phone compared digit-by-digit; either match is sufficient. */
function matchesContact(owner: Pick<Owner, "email" | "phone">, contact: LookupContactInfo): boolean {
  if (contact.email && contact.email.trim().toLowerCase() === owner.email.trim().toLowerCase()) {
    return true;
  }
  if (contact.phone) {
    const supplied = normalizePhoneDigits(contact.phone);
    if (supplied.length > 0 && supplied === normalizePhoneDigits(owner.phone)) {
      return true;
    }
  }
  return false;
}

/**
 * Factory taking a repository implementation plus the collaborating services — Step 17
 * wires in the Prisma-backed `BookingRepository`; the composition root (no later than
 * Step 12) passes the real `CustomerService`/`CatalogService`/`AvailabilityService`
 * instances, and (once Step 8 exists) the real `NotificationService`.
 */
export function createBookingService(deps: BookingServiceDependencies): BookingService {
  const { repository, customer, catalog, availability, notification } = deps;

  /** Flow 1/2, step 1 — resolves (or creates) the Owner, with its current pets, for either input shape. */
  async function resolveOwnerWithPets(ref: OwnerReference): Promise<{ owner: Owner; petIds: Set<string> }> {
    if (ref.kind === "ownerId") {
      const owner = await customer.getOwner(ref.ownerId);
      if (!owner) {
        throw new BookingValidationError(`owner not found: ${ref.ownerId}`);
      }
      return { owner, petIds: new Set(owner.pets.map((p) => p.id)) };
    }

    const owner = await customer.createOrFindOwner(ref.contact); // BR-CUST-1/2/3
    const withPets = await customer.getOwner(owner.id);
    if (!withPets) {
      // Defensive — createOrFindOwner just returned this id; should never actually happen.
      throw new BookingValidationError(`owner not found: ${owner.id}`);
    }
    return { owner: withPets, petIds: new Set(withPets.pets.map((p) => p.id)) };
  }

  /** Flow 1/2, steps 2-3 — resolves each pet (existing or new) and builds its line item's price/duration snapshot (BR-CAT-4). */
  async function resolveLineItems(
    ownerId: string,
    existingPetIds: Set<string>,
    pairs: PetServicePair[],
  ): Promise<CreateAppointmentLineItemInput[]> {
    const lineItems: CreateAppointmentLineItemInput[] = [];
    for (const pair of pairs) {
      let petId: string;
      if (pair.pet.kind === "existingPet") {
        if (!existingPetIds.has(pair.pet.petId)) {
          throw new InvalidPetReferenceError(pair.pet.petId);
        }
        petId = pair.pet.petId;
      } else {
        const pet = await customer.addPet(ownerId, pair.pet.details); // BR-CUST-5/6
        petId = pet.id;
        existingPetIds.add(petId);
      }

      const service = await catalog.getService(pair.serviceId);
      if (!service || !service.active) {
        throw new UnbookableServiceError(pair.serviceId); // deactivated services are hidden from booking (BR-CAT-2)
      }
      lineItems.push({
        petId,
        serviceId: service.id,
        priceSnapshot: service.price, // BR-CAT-4
        durationSnapshotMinutes: service.durationMinutes,
      });
    }
    return lineItems;
  }

  /**
   * BR-BOOK-8 — attempts to persist with a freshly generated bookingReference, retrying
   * on a collision (rare, given the random suffix's space) rather than surfacing it to
   * the caller. `appointmentId` is fixed across retries (it was already used for the
   * availability claim); only the reference regenerates.
   */
  async function persistAppointment(
    appointmentId: string,
    base: Omit<CreateAppointmentInput, "id" | "bookingReference">,
  ): Promise<AppointmentWithLineItems> {
    const maxAttempts = 5;
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const bookingReference = generateBookingReference();
      try {
        return await repository.createAppointment({ ...base, id: appointmentId, bookingReference });
      } catch (err) {
        if (err instanceof BookingReferenceCollisionError) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("failed to generate a unique booking reference");
  }

  async function resolveGroomerId(): Promise<string> {
    const groomer = await repository.findDefaultGroomer();
    if (!groomer) {
      throw new NoGroomerAvailableError();
    }
    return groomer.id;
  }

  return {
    async createBooking(input) {
      validateCreateBookingInput(input);

      const { owner, petIds } = await resolveOwnerWithPets(input.owner); // Flow 1, step 1
      const lineItems = await resolveLineItems(owner.id, petIds, input.petServicePairs); // Flow 1, steps 2-3
      const totalDuration = lineItems.reduce((sum, li) => sum + li.durationSnapshotMinutes, 0); // Flow 1, step 4 (BR-BOOK-1)
      const groomerId = await resolveGroomerId();
      const appointmentId = generateAppointmentId();

      const slot: SlotRequest = { start: input.slotStart, durationMinutes: totalDuration };
      try {
        await availability.claimSlot(slot, appointmentId); // Flow 1, step 5 (BR-AVAIL-5/6)
      } catch (err) {
        if (err instanceof AvailabilitySlotNotAvailableError) {
          throw new SlotNotAvailableError();
        }
        throw err;
      }

      const appointment = await persistAppointment(appointmentId, {
        ownerId: owner.id,
        groomerId,
        slotStart: input.slotStart,
        slotEnd: addMinutes(input.slotStart, totalDuration),
        status: "Booked",
        createdBy: input.createdBy,
        isOverride: false,
        hasConflict: false,
        visitNotes: input.visitNotes ?? null,
        lineItems,
      }); // Flow 1, step 6

      await notification.sendBookingConfirmation(appointment); // Flow 1, step 7
      await notification.scheduleReminder(appointment); // Flow 1, step 8

      return appointment;
    },

    async createOverrideBooking(input) {
      validateCreateBookingInput(input);

      const { owner, petIds } = await resolveOwnerWithPets(input.owner); // Flow 2, steps 1-4 (same as Flow 1)
      const lineItems = await resolveLineItems(owner.id, petIds, input.petServicePairs);
      const totalDuration = lineItems.reduce((sum, li) => sum + li.durationSnapshotMinutes, 0);
      const groomerId = await resolveGroomerId();
      const appointmentId = generateAppointmentId();

      const slot: SlotRequest = { start: input.slotStart, durationMinutes: totalDuration };
      const { conflictFlag, isOverride } = await availability.forceClaimSlot(slot, appointmentId); // Flow 2, step 5 (BR-AVAIL-10)

      const appointment = await persistAppointment(appointmentId, {
        ownerId: owner.id,
        groomerId,
        slotStart: input.slotStart,
        slotEnd: addMinutes(input.slotStart, totalDuration),
        status: "Booked",
        createdBy: input.createdBy,
        isOverride,
        hasConflict: conflictFlag,
        visitNotes: input.visitNotes ?? null,
        lineItems,
      }); // Flow 2, step 6

      await notification.sendBookingConfirmation(appointment); // Flow 2, steps 7-8 (BR-BOOK-11)
      await notification.scheduleReminder(appointment);

      return appointment;
    },

    async lookupBooking(bookingReference, contact) {
      validateLookupInput(bookingReference, contact);

      const appointment = await repository.findAppointmentByReference(bookingReference); // Flow 5, step 1
      if (!appointment) {
        throw new BookingLookupNotFoundError(); // never reveal whether the reference itself is valid
      }

      const owner = await customer.getOwner(appointment.ownerId);
      if (!owner || !matchesContact(owner, contact)) {
        throw new BookingLookupNotFoundError(); // Flow 5, step 2 — same generic error either way (BR-BOOK-5)
      }

      return withEffectiveStatus(appointment);
    },

    async listMyBookings(ownerId) {
      // component-methods.md's `listMyBookings(accountId)` is resolved to `ownerId` here:
      // `auth`'s `PublicAuthIdentity.ownerId` already gives the API layer (Step 12) the
      // Owner id directly from a validated session, and `customer` exposes no
      // "find Owner by authIdentityId" lookup this module could otherwise use — the
      // caller is expected to pass the already-resolved Owner id (see the interface's
      // doc comment).
      const appointments = await repository.listByOwner(ownerId);
      return withEffectiveStatusList(appointments);
    },

    async listAllBookings(range) {
      const appointments = await repository.listByDateRange(range);
      return withEffectiveStatusList(appointments);
    },

    async cancelBooking(appointmentId, actor) {
      const appointment = await repository.findAppointmentById(appointmentId); // Flow 3, step 1
      if (!appointment) {
        throw new AppointmentNotFoundError(appointmentId);
      }
      if (computeEffectiveStatus(appointment.status, appointment.slotEnd) !== "Booked") {
        throw new AppointmentNotModifiableError(); // BR-BOOK-6
      }

      await availability.releaseSlot(appointmentId); // Flow 3, step 2 (BR-AVAIL-11)
      const updated = await repository.updateStatus(appointmentId, {
        status: "Cancelled",
        cancelledAt: new Date(),
        cancelledBy: actor,
      }); // Flow 3, step 3

      await notification.cancelScheduledReminder(appointmentId); // Flow 3, step 4
      await notification.sendCancellationConfirmation(updated); // Flow 3, step 5 (BR-BOOK-9 — always the customer)

      return withEffectiveStatus(updated);
    },

    async rescheduleBooking(appointmentId, newSlotStart) {
      validateRescheduleInput(newSlotStart);

      const appointment = await repository.findAppointmentById(appointmentId); // Flow 4, step 1
      if (!appointment) {
        throw new AppointmentNotFoundError(appointmentId);
      }
      if (computeEffectiveStatus(appointment.status, appointment.slotEnd) !== "Booked") {
        throw new AppointmentNotModifiableError(); // BR-BOOK-6
      }

      const totalDuration = appointment.lineItems.reduce((sum, li) => sum + li.durationSnapshotMinutes, 0); // Flow 4, step 2 — unchanged by a reschedule

      const slot: SlotRequest = { start: newSlotStart, durationMinutes: totalDuration };
      try {
        await availability.claimSlot(slot, appointmentId); // Flow 4, step 3 — claim the NEW slot first (BR-BOOK-3)
      } catch (err) {
        if (err instanceof AvailabilitySlotNotAvailableError) {
          throw new SlotNotAvailableError(); // original Appointment untouched
        }
        throw err;
      }

      await availability.releaseSlot(appointmentId); // Flow 4, step 4 — only once the new claim succeeded

      const updated = await repository.updateSlot(appointmentId, {
        slotStart: newSlotStart,
        slotEnd: addMinutes(newSlotStart, totalDuration),
      }); // Flow 4, step 5 (same id/bookingReference — BR-BOOK-3)

      await notification.cancelScheduledReminder(appointmentId); // Flow 4, step 6 (BR-BOOK-10)
      await notification.scheduleReminder(updated);

      return withEffectiveStatus(updated);
    },

    async markNoShow(appointmentId) {
      const appointment = await repository.findAppointmentById(appointmentId); // Flow 7, step 1
      if (!appointment) {
        throw new AppointmentNotFoundError(appointmentId);
      }
      if (computeEffectiveStatus(appointment.status, appointment.slotEnd) !== "Completed") {
        throw new AppointmentNotEligibleForNoShowError(); // BR-BOOK-2b
      }
      return repository.updateStatus(appointmentId, { status: "NoShow" }); // Flow 7, step 2
    },

    async flagAppointmentsForReview(appointmentIds) {
      if (appointmentIds.length === 0) return;
      await repository.setFlaggedForReview(appointmentIds, true); // BR-AVAIL-9
    },

    async updateVisitNotes(appointmentId, visitNotes) {
      const appointment = await repository.findAppointmentById(appointmentId);
      if (!appointment) {
        throw new AppointmentNotFoundError(appointmentId);
      }
      const updated = await repository.updateVisitNotes(appointmentId, visitNotes); // BR-BOOK-7
      return withEffectiveStatus(updated);
    },
  };
}
