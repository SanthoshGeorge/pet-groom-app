# NFR Design Patterns — Pet Grooming Booking Platform

Concrete design patterns resolving the 8 questions from `pet-grooming-booking-platform-nfr-design-plan.md`, organized by the 5 mandatory categories.

## Resilience Patterns

**Notification sends: no retry (Q1=A).**
A failed email/SMS attempt (either channel) sets `Appointment.notificationFailed = true` (BR-NOTIF-4) immediately, with no automatic retry. This keeps `notification`'s send path simple and synchronous-feeling, consistent with NFR-5. The owner-visible flag (BR-NOTIF-4) is the actual resilience mechanism here — a human catches what an automated retry would have papered over anyway, at this shop's volume.

**Slot-claim concurrency: database constraint, not application locking (Q2=A).**
`claimSlot`/`forceClaimSlot` rely on a Postgres unique constraint (or an `EXCLUDE` constraint covering the time range, to also catch overlapping-but-not-identical slots) on the appointment table, scoped to `(groomerId, [slotStart, slotEnd))`. The claim path is: attempt the `Appointment` insert directly inside a transaction; a constraint violation is caught and translated to BR-AVAIL-5/BR-AVAIL-6's "slot no longer available" error. No `SELECT ... FOR UPDATE`, no application-level mutex — the database is the single source of truth for "is this slot taken," which is exactly the guarantee BR-AVAIL-5 requires and avoids an entire class of bugs around forgetting to lock correctly.

## Scalability Patterns

**Availability reads: always live, no caching (Q3=A).**
`getAvailableSlots` always queries current data — no cache layer. At this shop's scale (a handful of concurrent viewers, one groomer, 75+ appointments/week), a live query costs nothing meaningful, and it sidesteps any cache-invalidation complexity that could itself introduce staleness bugs. Revisit only if real usage ever shows this query as a measured bottleneck — not anticipated at this scale.

**No horizontal scaling design needed.**
The chosen stack (Vercel serverless functions + managed Postgres) scales automatically with request volume with zero application-level design work — there's no stateful in-process data (sessions live in the database/cookie, not in server memory) that would prevent running many function instances concurrently.

## Performance Patterns

**Appointment lists: bounded by date range, not paginated (Q4=B).**
`listAllBookings(dateRange)` and `listMyBookings(accountId)` return full result sets for now, relying on `listAllBookings`'s existing `dateRange` parameter (e.g. the admin calendar naturally queries "this week") to keep result sets small in practice rather than adding pagination machinery. `listMyBookings` (a single customer's own bookings) will rarely exceed a few dozen rows even over years, so it doesn't need bounding at all. Revisit pagination if the admin ever queries an unbounded range (e.g. "all appointments ever") and that becomes slow in practice.

## Security Patterns

**Input validation: manual, per-route (Q5=B).**
API routes validate their own inputs directly (required-field checks, type checks) rather than through a shared schema-validation library. **Named risk, not silently accepted**: this is more likely to be inconsistent or miss a field across the ~20+ routes than a schema-based approach would be — accepted here as the "simple approach" per your instruction, but flagged so it's a visible trade-off, not an oversight. Mitigation available at low cost if this becomes a problem in practice: routes that touch money-shaped or identity-shaped data (none exist in v1 — no payments per FR-9) or the auth endpoints specifically are the highest-value places to double up on validation care during Code Generation, even without adopting a library project-wide.

**Rate limiting: none in v1 (Q6=B).**
Login and password-reset-request have no attempt throttling. Matches NFR-4's literal scope (no formal Security Baseline). Accepted risk: hand-rolled auth (NFR Requirements Q4) with no rate limiting is more exposed to credential-stuffing/brute-force than the alternative — judged acceptable given the auth surface is small (2 roles, no payment data on file) and this is a solo-maintained v1, not a mitigation-free stance forever. Cheap to add later (a small middleware check) without any rework of the auth logic itself.

**Route-level authorization stays as designed in Functional Design.**
Every admin-only method (`listAllBookings`, `createOverrideBooking`, `markNoShow`, catalog/availability management, etc.) checks `auth.validateSession` with `role = owner` server-side on every call — this was already established across the Functional Design passes and isn't changed by this NFR Design pass; restated here because it's the actual backbone of this system's security posture, more than either of the two patterns above.

## Logical Components

See `logical-components.md` for the full list — this section only calls out the ones with a resilience/security dimension:
- **Cron endpoint**: protected by a shared-secret header (Q7=A), not IP allowlisting.
- **Logging**: platform-native only, no separate error-tracking service (Q8=A) — see `logical-components.md`.
