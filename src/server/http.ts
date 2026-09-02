// Shared HTTP helpers for API route handlers (`src/app/api/**/route.ts`).
//
// Established here in Code Generation Step 12 (Phase D, "Public API Routes") as the shared
// convention every later route-handling step (Step 13's admin routes, Step 14's cron route)
// is expected to reuse rather than reinvent — see the Code Generation plan's Phase D.
//
// Response conventions every route in this codebase follows:
//   - success: `jsonOk(payload)` (200) or `jsonCreated(payload)` (201, for a newly created
//     resource) — always `NextResponse.json(payload, { status })`, payload is a plain
//     object whose top-level key names the resource (`{ appointment }`, `{ services }`,
//     `{ identity }`, ...), not a bare array/value.
//   - failure: `{ error: string }` via `jsonError`/`errorToResponse`, status chosen from the
//     thrown error's `.name` (see STATUS_BY_ERROR_NAME below). Every route's business-logic
//     call sits in a single `try { ... } catch (err) { return errorToResponse(err); }` block
//     — this is what lets a route stay ignorant of every module's specific error classes.
//   - input validation is manual and per-route (no schema-validation library), per
//     nfr-design-patterns.md's Security Patterns ("Input validation: manual, per-route,
//     Q5=B") — `readJsonBody`/`HttpError` below are the small shared plumbing that approach
//     still benefits from (one place that turns "body isn't valid JSON" / "body isn't an
//     object" into a consistent 400), not a schema-validation library in disguise. Each
//     route is still expected to hand-check its own required fields, exactly as every
//     `src/modules/*/validation.ts` already does at the business-logic layer.

import { NextResponse } from "next/server";

/**
 * A route-local validation/authorization failure with an explicit HTTP status, thrown by a
 * route handler itself — as opposed to a business-logic module's own error types (thrown
 * from inside `src/modules/*`), which `errorToResponse` maps to a status by `.name` instead
 * (see STATUS_BY_ERROR_NAME below).
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** 201 Created — the created resource is the body, per this codebase's convention. */
export function jsonCreated<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Reads and parses a request body as JSON, throwing `HttpError(400, ...)` — never a raw
 * `SyntaxError` — on malformed JSON or a non-object body. Every route that expects a JSON
 * body calls this first, so "bad input" always reaches the client as a clear 400 rather than
 * an unhandled parse exception surfacing as a 500. Field-level checks (required fields,
 * types, enum membership) are still each route's own job, same as the manual-validation
 * convention each module's own `validation.ts` under `src/modules/` already follows.
 */
export async function readJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }
  return body as T;
}

/**
 * Maps a thrown error's `.name` to an HTTP status. Every module's error classes
 * (each module's own `errors.ts` under `src/modules/`) already follow one naming convention, so this lookup table —
 * not per-module `instanceof` imports — is what keeps this file decoupled from the modules
 * it fronts (no route or shared helper needs to import e.g. `AppointmentNotFoundError`
 * directly just to map it to 404). Two module pairs deliberately share an error class name
 * (`ServiceNotFoundError` in both `catalog` and `availability`; `SlotNotAvailableError` in
 * both `availability` and `booking`) — both members of each pair map to the same status, so
 * one table entry covers both correctly. Extend this table (never invent a parallel
 * mechanism) when a later step's route needs to map an error type not yet listed here.
 */
const STATUS_BY_ERROR_NAME: Record<string, number> = {
  // 400 — malformed/invalid input, caught by a module's own manual validation.
  AuthValidationError: 400,
  CustomerValidationError: 400,
  CatalogValidationError: 400,
  AvailabilityValidationError: 400,
  BookingValidationError: 400,
  InvalidPetReferenceError: 400,
  UnbookableServiceError: 400,
  InvalidResetTokenError: 400,
  // Added in Step 13 for `GET /api/admin/reports` — `period` must be "ThisWeek"/"ThisMonth".
  InvalidReportPeriodError: 400,

  // 401 — authentication failure (deliberately generic messages at the module layer).
  InvalidCredentialsError: 401,

  // 404 — the referenced resource doesn't exist.
  OwnerNotFoundError: 404,
  PetNotFoundError: 404,
  ServiceNotFoundError: 404, // shared name: both `catalog` and `availability` define one
  AppointmentNotFoundError: 404,
  // BR-BOOK-5 — deliberately generic ("no booking found matching..."); mapped to a plain
  // 404 like any other not-found, never distinguished from one by the response shape.
  BookingLookupNotFoundError: 404,

  // 409 — the request is well-formed but conflicts with the resource's current state.
  EmailAlreadyUsedError: 409,
  SlotNotAvailableError: 409, // shared name: both `availability` and `booking` define one
  AppointmentNotModifiableError: 409, // BR-BOOK-6
  AppointmentNotEligibleForNoShowError: 409, // BR-BOOK-2b

  // 500 — defensive/should-not-happen conditions (e.g. FR-2's single-groomer invariant).
  NoGroomerAvailableError: 500,
};

/**
 * Turns any thrown value into a JSON error `NextResponse` — the single place that decides
 * "what HTTP status does this failure deserve." Unrecognized errors (a real bug, or a module
 * error not yet added to the table above) fall back to a logged 500 rather than leaking an
 * internal error message to the client.
 */
export function errorToResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return jsonError(err.message, err.status);
  }
  if (err instanceof Error) {
    const status = STATUS_BY_ERROR_NAME[err.name];
    if (status !== undefined) {
      return jsonError(err.message, status);
    }
  }
  console.error("Unhandled API route error:", err);
  return jsonError("An unexpected error occurred", 500);
}
