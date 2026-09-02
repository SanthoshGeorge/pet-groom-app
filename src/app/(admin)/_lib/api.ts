// Thin fetch wrappers around the Step 13 admin API routes (`src/app/api/admin/**`), plus
// the two public routes the admin site legitimately reuses (`GET /api/services`,
// `GET /api/availability` — see the header comments on `fetchServices`/`fetchSlots` below
// for why) and `POST /api/auth/logout` (one login/session system for the whole app, no
// separate admin auth routes). Mirrors `(public)/_lib/api.ts`'s pattern exactly (same
// `ApiError`/`request` shape) but is its own self-contained file — the admin site is a
// different, owner-only part of the app and isn't meant to import from `(public)/`.
//
// Types are `import type`-only from the business-logic modules (erased at compile time),
// same convention `(public)/_lib/api.ts` already follows — never a runtime import of
// `@/modules/*`.

import type { AppointmentWithLineItems, BookingActor } from "@/modules/booking";
import type {
  AddTimeOffResult,
  DayOfWeek,
  SetWorkingHoursResult,
  Slot,
  TimeOff,
  WorkingHoursRuleInput,
} from "@/modules/availability";
import type { AppointmentSummary, ReportPeriod } from "@/modules/reporting";
import type { PetSize } from "@/modules/customer";
import type { Service } from "@/modules/catalog";

export type {
  AppointmentWithLineItems,
  BookingActor,
  DayOfWeek,
  Service,
  Slot,
  TimeOff,
  WorkingHoursRuleInput,
  PetSize,
  ReportPeriod,
  AppointmentSummary,
};

/** Every route in this codebase reports failure as `{ error: string }` (src/server/http.ts). */
interface ApiErrorBody {
  error?: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await parseJson(response);
  if (!response.ok) {
    const message = (body as ApiErrorBody).error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return body as T;
}

// --- Session / logout ---------------------------------------------------------------------

/** POST /api/auth/logout — idempotent; clears the session cookie server-side either way. */
export function logout(): Promise<void> {
  return request<{ success: boolean }>("/api/auth/logout", { method: "POST" }).then(() => undefined);
}

// --- Calendar / appointments (SO-1) ---------------------------------------------------------

/** GET /api/admin/appointments?start=&end= — SO-1's admin calendar. Owner-only. */
export function fetchAppointments(start: Date, end: Date): Promise<AppointmentWithLineItems[]> {
  const params = new URLSearchParams({ start: start.toISOString(), end: end.toISOString() });
  return request<{ appointments: AppointmentWithLineItems[] }>(
    `/api/admin/appointments?${params.toString()}`,
  ).then((body) => body.appointments);
}

/** POST /api/admin/appointments/:id/no-show — Flow 7, SO-6's data source. Owner-only. */
export function markNoShow(appointmentId: string): Promise<AppointmentWithLineItems> {
  return request<{ appointment: AppointmentWithLineItems }>(
    `/api/admin/appointments/${appointmentId}/no-show`,
    { method: "POST" },
  ).then((body) => body.appointment);
}

// --- New booking on behalf of a customer (SO-3) ---------------------------------------------

export interface NewPetInput {
  name: string;
  breed: string;
  size: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

export interface AdminBookingPetInput {
  petId?: string;
  newPet?: NewPetInput;
  serviceId: string;
}

export interface AdminCreateBookingRequest {
  ownerId?: string;
  contact?: { name: string; phone: string; email: string };
  pets: AdminBookingPetInput[];
  slotStart: string;
  visitNotes?: string | null;
}

/**
 * POST /api/admin/bookings — SO-3, the override/conflict-warning booking-on-behalf-of-a-
 * customer variant (`booking.createOverrideBooking`, never the plain public flow). Owner-only.
 * Always succeeds (barring a validation error) — there's no separate "preview" endpoint;
 * BR-AVAIL-10's conflict warning surfaces on the *returned* appointment's `hasConflict`/
 * `isOverride` fields, which `NewBookingPage` reads to show the post-booking warning banner.
 */
export function createAdminBooking(payload: AdminCreateBookingRequest): Promise<AppointmentWithLineItems> {
  return request<{ appointment: AppointmentWithLineItems }>("/api/admin/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((body) => body.appointment);
}

/**
 * GET /api/availability?serviceId=&start=&end= — the public slot-browsing route (Step 12),
 * reused here (not a new admin route — none exists for this, and Step 22 must not add one)
 * to know which of the New Booking grid's candidate times fall within *normal* hours/buffer/
 * time-off, so the override toggle can visually distinguish "normal" from "override-only"
 * slots the same way the mockup's dashed slots do. This is a read-only, unauthenticated-safe
 * route already; calling it from an owner-gated page is harmless.
 */
export function fetchSlots(serviceId: string, start: Date, end: Date): Promise<Slot[]> {
  const params = new URLSearchParams({ serviceId, start: start.toISOString(), end: end.toISOString() });
  return request<{ slots: Slot[] }>(`/api/availability?${params.toString()}`).then((body) => body.slots);
}

// --- Services & Prices (SO-4) ----------------------------------------------------------------

/**
 * GET /api/services — the public, active-only catalog route (Step 12), reused here as
 * `AdminServicesPage`'s data source. JUDGMENT CALL / KNOWN LIMITATION: no admin-scoped
 * listing route exists (`catalog.listAllServices()` is implemented at the module layer —
 * see `src/modules/catalog/service.ts` — but Step 13 never wired an API route to it, and
 * this step must not add one). This means a freshly loaded Services page can only show
 * currently-active services; a service deactivated in an *earlier* session won't reappear
 * in the list on next load (though it's still preserved for history server-side, per
 * BR-CAT-2 — it's only this admin view's listing that can't see it). Within one session,
 * `AdminServicesPage` keeps newly created/edited/deactivated services in local state so the
 * list stays accurate as the admin works, without needing to re-fetch.
 */
export function fetchServices(): Promise<Service[]> {
  return request<{ services: Service[] }>("/api/services").then((body) => body.services);
}

export interface CreateServiceInput {
  name: string;
  price: number;
  durationMinutes: number;
}

/** POST /api/admin/services — SO-4. Owner-only. */
export function createService(input: CreateServiceInput): Promise<Service> {
  return request<{ service: Service }>("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((body) => body.service);
}

export interface UpdateServiceInput {
  name?: string;
  price?: number;
  durationMinutes?: number;
}

/** PATCH /api/admin/services/:id — SO-4, edit. Owner-only. */
export function updateService(serviceId: string, fields: UpdateServiceInput): Promise<Service> {
  return request<{ service: Service }>(`/api/admin/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  }).then((body) => body.service);
}

/** PATCH /api/admin/services/:id { active: false } — SO-4, soft-deactivate (BR-CAT-2). Owner-only. */
export function deactivateService(serviceId: string): Promise<Service> {
  return request<{ service: Service }>(`/api/admin/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify({ active: false }),
  }).then((body) => body.service);
}

// --- Working hours & time off (SO-5) ----------------------------------------------------------
// No GET counterpart exists for either route below (confirmed by `(public)/(marketing)/about/
// page.tsx`'s own header comment: "the only working-hours data in this codebase is admin-only,
// `POST /api/admin/hours`, with no [way to read it back]") — see `AdminHoursPage`'s own header
// comment for how it works around that (write-only form, no pre-populated current state).

/** POST /api/admin/hours — SO-5. Owner-only. BR-AVAIL-9: returns ids of appointments the new hours no longer cover. */
export function setWorkingHours(schedule: WorkingHoursRuleInput[]): Promise<SetWorkingHoursResult> {
  return request<SetWorkingHoursResult>("/api/admin/hours", {
    method: "POST",
    body: JSON.stringify({ schedule }),
  });
}

export interface AddTimeOffInput {
  startDate: string;
  endDate: string;
  reason?: string | null;
}

/** POST /api/admin/time-off — SO-5. Owner-only. BR-AVAIL-9: returns ids of appointments the block now covers. */
export function addTimeOff(input: AddTimeOffInput): Promise<AddTimeOffResult> {
  return request<AddTimeOffResult>("/api/admin/time-off", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Reports (SO-6) -----------------------------------------------------------------------

/** GET /api/admin/reports?period=ThisWeek|ThisMonth — SO-6, BR-REPORT-1..4. Owner-only. */
export function fetchReportSummary(period: ReportPeriod): Promise<AppointmentSummary> {
  const params = new URLSearchParams({ period });
  return request<{ summary: AppointmentSummary }>(`/api/admin/reports?${params.toString()}`).then(
    (body) => body.summary,
  );
}
