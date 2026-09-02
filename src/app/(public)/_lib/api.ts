// Thin fetch wrappers around the Step 12 public API routes (`src/app/api/availability`,
// `src/app/api/bookings*`, `src/app/api/services`) — every public-site client component
// goes through these rather than calling `fetch` ad hoc, so the request/response shapes
// documented on those route files (read in full before writing this) live in exactly one
// place. Types are `import type`-only from the business-logic modules (erased at compile
// time, same convention the route handlers themselves use) — never a runtime import of
// `@/modules/*`, which would pull in server-only/Prisma-adjacent code.

import type { Slot } from "@/modules/availability";
import type {
  Appointment,
  AppointmentWithLineItems,
  BookingActor,
  LookupContactInfo,
} from "@/modules/booking";
import type { OwnerWithPets, Pet, PetSize } from "@/modules/customer";
import type { Service } from "@/modules/catalog";
import type { PublicAuthIdentity } from "@/modules/auth";

export type {
  Slot,
  Appointment,
  AppointmentWithLineItems,
  BookingActor,
  LookupContactInfo,
  OwnerWithPets,
  Pet,
  PetSize,
  Service,
  PublicAuthIdentity,
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

/** GET /api/services — FR-1 catalog browsing (BR-CAT-1: active/bookable services only). */
export function fetchServices(): Promise<Service[]> {
  return request<{ services: Service[] }>("/api/services").then((body) => body.services);
}

/** GET /api/availability?serviceId=&start=&end= — GC-1/RC-1 slot browsing. */
export function fetchAvailability(serviceId: string, start: Date, end: Date): Promise<Slot[]> {
  const params = new URLSearchParams({
    serviceId,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  return request<{ slots: Slot[] }>(`/api/availability?${params.toString()}`).then((body) => body.slots);
}

export interface NewPetInput {
  name: string;
  breed: string;
  size: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

export interface CreateBookingPetInput {
  petId?: string;
  newPet?: NewPetInput;
  serviceId: string;
}

export interface CreateBookingRequest {
  contact?: { name: string; phone: string; email: string };
  pets: CreateBookingPetInput[];
  slotStart: string;
  visitNotes?: string | null;
}

/** POST /api/bookings — GC-2 (guest) / RC-2 (account, once Step 21 lands) shared flow. */
export function createBooking(payload: CreateBookingRequest): Promise<Appointment> {
  return request<{ appointment: Appointment }>("/api/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((body) => body.appointment);
}

/** POST /api/bookings/lookup — GC-3 guest self-service lookup. BR-BOOK-5. */
export function lookupBooking(
  bookingReference: string,
  contact: LookupContactInfo,
): Promise<AppointmentWithLineItems> {
  return request<{ appointment: AppointmentWithLineItems }>("/api/bookings/lookup", {
    method: "POST",
    body: JSON.stringify({ bookingReference, contact }),
  }).then((body) => body.appointment);
}

/** PATCH /api/bookings/:id — cancel. Guest callers must also pass the same reference+contact used to look the booking up (BR-BOOK-5). */
export function cancelBooking(
  appointmentId: string,
  guestProof?: { bookingReference: string; contact: LookupContactInfo },
): Promise<AppointmentWithLineItems> {
  return request<{ appointment: AppointmentWithLineItems }>(`/api/bookings/${appointmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "cancel", ...guestProof }),
  }).then((body) => body.appointment);
}

/** PATCH /api/bookings/:id — reschedule. Same guest-proof requirement as `cancelBooking`. */
export function rescheduleBooking(
  appointmentId: string,
  slotStart: Date,
  guestProof?: { bookingReference: string; contact: LookupContactInfo },
): Promise<AppointmentWithLineItems> {
  return request<{ appointment: AppointmentWithLineItems }>(`/api/bookings/${appointmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "reschedule", slotStart: slotStart.toISOString(), ...guestProof }),
  }).then((body) => body.appointment);
}

// --- Auth (Step 21) ---------------------------------------------------------------------
// Thin wrappers around the Step 12 `/api/auth/*` routes. Every one of these routes returns
// `{ error }` on failure via the same `ApiError` path as the booking wrappers above, so
// BR-AUTH-3's generic-message guarantee (never reveal *why* login/reset failed) comes
// through untouched as `err.message` — these wrappers add no branching of their own on top
// of what the route/module already decided.

export interface LoginRequest {
  email: string;
  password: string;
}

/** POST /api/auth/login — Flow 3. 401 with a generic message on any failure (BR-AUTH-3). */
export function login(payload: LoginRequest): Promise<PublicAuthIdentity> {
  return request<{ identity: PublicAuthIdentity }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((body) => body.identity);
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
}

/** POST /api/auth/register — Flow 2 (RC-1). Logs the new account in immediately on success. */
export function registerAccount(payload: RegisterRequest): Promise<PublicAuthIdentity> {
  return request<{ identity: PublicAuthIdentity }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((body) => body.identity);
}

/** POST /api/auth/logout — idempotent; clears the session cookie server-side either way. */
export function logout(): Promise<void> {
  return request<{ success: boolean }>("/api/auth/logout", { method: "POST" }).then(() => undefined);
}

/** POST /api/auth/forgot-password — Flow 4. Same response regardless of match (BR-AUTH-3). */
export function requestPasswordReset(email: string): Promise<string> {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  }).then((body) => body.message);
}

/** POST /api/auth/reset-password — Flow 4, step 3. Does not log the caller back in. */
export function resetPassword(token: string, newPassword: string): Promise<string> {
  return request<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  }).then((body) => body.message);
}

// --- Account / pets (Step 21, RC-1) -----------------------------------------------------
// Both routes require a `role=customer` session cookie (set by `login`/`registerAccount`
// above) — a 401 `ApiError` from `fetchAccountPets` is this app's signal for "not logged
// in," used by both the account page and the shared header's login-state check.

/** GET /api/account/pets — the logged-in customer's own Owner + pets. 401 if not logged in. */
export function fetchAccountPets(): Promise<OwnerWithPets> {
  return request<{ owner: OwnerWithPets }>("/api/account/pets").then((body) => body.owner);
}

export interface SavePetInput {
  /** Presence means update; absence means create (matches the route's own add-vs-update branch). */
  petId?: string;
  name: string;
  breed: string;
  size: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

/** PATCH /api/account/pets — add (`petId` omitted, 201) or update (`petId` present, 200) a pet. */
export function savePet(input: SavePetInput): Promise<Pet> {
  return request<{ pet: Pet }>("/api/account/pets", {
    method: "PATCH",
    body: JSON.stringify(input),
  }).then((body) => body.pet);
}
