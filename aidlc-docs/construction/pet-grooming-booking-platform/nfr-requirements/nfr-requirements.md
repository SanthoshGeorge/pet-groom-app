# NFR Requirements — Pet Grooming Booking Platform

Refines `requirements.md`'s NFR-1..7 into concrete, testable requirements now that the tech stack is chosen (see `tech-stack-decisions.md`) and Functional Design is complete for all 7 modules.

## Scalability

- Target load: 75+ appointments/week today (NFR-3), which translates to roughly 2-5 concurrent users at any given moment realistically — trivial load for any modern managed platform.
- The chosen stack (Vercel + managed Postgres) scales automatically with zero manual intervention up to well beyond any plausible near-term volume for a single-groomer shop, satisfying NFR-3's "shouldn't need a redesign" bar without any deliberate over-engineering.
- Multi-groomer/multi-location growth (NFR-3's stated future direction) is a data/configuration change (more `Groomer` rows, a `Location` concept added later), not an architecture change — already designed for in `customer`'s `Groomer` entity (Q6=A from that pass: minimal now, room to grow).

## Performance

- No explicit response-time SLA was requested and none is warranted at this scale — standard web-app expectations apply (page loads and API calls in the low hundreds of milliseconds, typical for the chosen serverless stack).
- The one performance-adjacent concern raised in Functional Design — `getAvailableSlots`' computation (Flow 1 of `availability-business-logic-model.md`) — operates over a bounded 14-day window (BR-AVAIL-4) with a small number of daily appointments, well within what a single database query plus in-memory grid computation handles instantly at this scale.

## Availability

- No formal uptime SLA (NFR-5 — Resiliency Baseline not applied). Vercel's and the chosen database provider's own platform-level uptime (both are managed services with their own published uptime track records) is relied upon as-is, with no additional failover/redundancy engineering on top — consistent with NFR-5's "reasonable defaults that come for free" framing.
- No disaster-recovery process beyond the database provider's own automated backups (a standard feature of managed Postgres offerings) is built in v1.

## Security

- NFR-4 (Security Baseline extension) is **not** enforced as a formal rule set, but standard sensible practices are followed throughout, consistent with what Functional Design already assumed:
  - Passwords: hashed (bcrypt/argon2), never stored or logged in plaintext (BR-AUTH-2's implementation)
  - Sessions: `httpOnly`/`Secure` cookies, not accessible to client-side JS (mitigates basic XSS token theft)
  - Login/password-reset: generic error messages that never reveal whether an email/account exists (Flow 3/4 of `business-logic-model.md`)
  - Guest booking lookup: same generic-error pattern (BR-BOOK-5/Flow 5 of `booking-business-logic-model.md`) — never reveals whether a reference is valid before contact info is confirmed
  - Admin routes gated by `auth.validateSession` with `role = owner` checked server-side on every call, not just hidden in the UI
- No rate-limiting, WAF, or formal threat-modeling exercise is in scope for v1 (would fall under the formal Security Baseline extension, explicitly declined in Requirements Analysis).

## Reliability

- `notification`'s BR-NOTIF-3 (channel failures never block the underlying booking/cancellation) and BR-NOTIF-4 (failures flagged on the appointment, not silently swallowed) are the primary reliability mechanisms in this system — the booking system stays correct and usable even when a third-party email/SMS provider has an outage.
- No automatic retry logic for failed notification sends in v1 (flagged as an open item in `notification-business-rules.md`, not built) — consistent with NFR-5.
- `availability`'s BR-AVAIL-5 (atomic slot claims) is the one place correctness genuinely matters under concurrent load (the GC-1 double-booking race) — addressed via the database's own transactional guarantees (see `tech-stack-decisions.md`'s Database section), not custom application-level locking.

## Maintainability

- TypeScript across the whole app (Q1) catches structural mismatches against the Functional Design's entity definitions at compile time.
- Code organization follows `unit-of-work.md`'s module structure exactly (`modules/auth`, `modules/customer`, etc.) — each module's implementation maps 1:1 to its Functional Design artifacts, so a future maintainer (the groomer's next developer, or Santhosh himself returning later) can trace any piece of code back to the business rule that justifies it.
- Unit + integration test coverage (Q8) over every business rule from Functional Design gives a maintainer confidence to change code without re-deriving the business logic from scratch.
- No staging environment (Q9) is a deliberate maintainability **trade-off**, not an oversight — appropriate for a one-person-maintained project at this scale; revisit if a second developer joins or the shop's real usage grows enough that testing-in-production risk increases.

## Usability

- No formal accessibility (WCAG) audit is in scope for v1 — not raised in any of the NFRs or stories, and not one of this pass's 10 questions. Standard semantic HTML and the component patterns already established in `frontend-components.md` (auth/customer/catalog pass) and the mockup canvas provide a reasonable baseline without a dedicated compliance effort.
- The public site's placeholder branding (NFR-2) is designed to be re-skinned without a rebuild — plain, professional default styling (already reflected in the mockup canvas's neutral color palette and typography choices) rather than anything hard to reskin later.

## Cost (NFR-7)

Everything in the chosen stack fits comfortably within free tiers **except SMS**, which is a real, if small, recurring cost (~$5-6/month at this shop's volume) — explicitly deferred to a stub/log-only implementation (Q6=B) pending your or the groomer's explicit approval to turn it on for real, per NFR-7's "no paid services without explicit approval."
