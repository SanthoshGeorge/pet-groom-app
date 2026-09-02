// booking module domain types — mirror the `Appointment` and `AppointmentLineItem`
// models in prisma/schema.prisma. Pure TypeScript so business logic compiles without the
// (not-yet-generated) Prisma client — see repository.ts for the abstraction boundary.
//
// Reuses `customer`'s and `catalog`'s real exported types directly (both already built,
// Steps 4-5) per the Code Generation task's explicit instruction — unlike `auth`'s
// `OwnerIdentityResolver` pattern (necessary there only because `customer` didn't exist
// yet at Step 3). `notification` (Step 8, built AFTER this module) gets that same
// minimal-collaborator-interface treatment instead — see service.ts.

import type { ContactInfo, PetCreateInput } from "@/modules/customer";

/** Appointment.status — booking-domain-entities.md "Status Lifecycle", matches prisma/schema.prisma's `AppointmentStatus` enum. */
export type AppointmentStatus = "Booked" | "Completed" | "Cancelled" | "NoShow";

/** Appointment.createdBy / Appointment.cancelledBy — matches prisma/schema.prisma's `BookingActor` enum. */
export type BookingActor = "guest" | "account" | "owner";

/** One visit — the booking itself. functional-design/booking-domain-entities.md "Appointment". */
export interface Appointment {
  id: string;
  /** Unique, shop-prefixed short code (e.g. "HTG-4821") — BR-BOOK-8. Used for guest lookup (GC-3). */
  bookingReference: string;
  ownerId: string;
  /** Auto-assigned (FR-2 — only one Groomer exists today); see repository.ts's `findDefaultGroomer`. */
  groomerId: string;
  slotStart: Date;
  /** `slotStart` + sum of all line items' `durationSnapshotMinutes` (availability's BR-AVAIL-1). */
  slotEnd: Date;
  /**
   * The raw, stored status. BR-BOOK-2 — a `Booked` row whose `slotEnd` has passed reads
   * as `Completed` by default without necessarily being written back (see status.ts's
   * `computeEffectiveStatus`, applied by this service to every Appointment it returns).
   * Treat this raw field as an implementation detail; callers outside this module should
   * only ever see the already-computed effective status returned by the service methods.
   */
  status: AppointmentStatus;
  /** Who initiated it — GC-2/RC-2/SO-2 share one underlying flow, differing only here. */
  createdBy: BookingActor;
  /** True if created via `createOverrideBooking` and it fell outside normal hours/buffer/time-off (SO-3) — drives the mockup's "OVERRIDE" badge. */
  isOverride: boolean;
  /** True if an override created it while overlapping another appointment (SO-3's warned-but-confirmed case). */
  hasConflict: boolean;
  /** True if a later working-hours/time-off change orphaned this appointment (availability's BR-AVAIL-9). */
  flaggedForReview: boolean;
  /**
   * True if either notification channel (or both) failed for a confirmation,
   * cancellation-confirmation, or reminder send (BR-NOTIF-4, `notification`-owned — Step
   * 8 writes it; this module only carries the field and never sets it itself, always
   * `false` at creation).
   */
  notificationFailed: boolean;
  /** This-visit-only note (BR-BOOK-7) — separate from any pet's permanent notes. */
  visitNotes: string | null;
  /** Set when `status` becomes `Cancelled`. */
  cancelledAt: Date | null;
  cancelledBy: BookingActor | null;
  createdAt: Date;
}

/** One pet + the service it's getting, within an Appointment. BR-BOOK-1 (Q1=A — per-pet service selection). */
export interface AppointmentLineItem {
  id: string;
  appointmentId: string;
  petId: string;
  serviceId: string;
  /** Copied from `Service.price` at booking time (BR-CAT-4). */
  priceSnapshot: number;
  /** Copied from `Service.durationMinutes` at booking time (BR-CAT-4). */
  durationSnapshotMinutes: number;
}

export interface AppointmentWithLineItems extends Appointment {
  lineItems: AppointmentLineItem[];
}

/** Either an already-known Owner (a logged-in customer, or an owner-on-behalf booking reusing an existing guest record) or fresh contact info to resolve/create one — Flow 1's "ownerInfo (or ownerId if already known/logged in)". */
export type OwnerReference = { kind: "ownerId"; ownerId: string } | { kind: "contact"; contact: ContactInfo };

/** One pet in a multi-pet visit: an existing saved pet, or details for a brand-new one (Flow 1, step 2). */
export type PetSelection =
  | { kind: "existingPet"; petId: string }
  | { kind: "newPet"; details: Omit<PetCreateInput, "ownerId"> };

/** Q1=A resolution — booking-domain-entities.md's note on `createBooking`'s refined signature: each pet paired with its own `serviceId`, not one shared service for the whole appointment. */
export interface PetServicePair {
  pet: PetSelection;
  serviceId: string;
}

/** Input shared by `createBooking` and `createOverrideBooking` (Flow 1 / Flow 2). */
export interface CreateBookingInput {
  owner: OwnerReference;
  petServicePairs: PetServicePair[];
  slotStart: Date;
  createdBy: BookingActor;
  /** BR-BOOK-7 — optional, this-visit-only note set at creation time. */
  visitNotes?: string | null;
}

/** BR-BOOK-5 — guest lookup contact info; at least one of `email`/`phone` must be supplied. */
export interface LookupContactInfo {
  email?: string;
  phone?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}
