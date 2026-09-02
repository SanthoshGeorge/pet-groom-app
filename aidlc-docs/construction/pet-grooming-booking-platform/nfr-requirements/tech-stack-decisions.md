# Tech Stack Decisions — Pet Grooming Booking Platform

All 10 answers from `pet-grooming-booking-platform-nfr-requirements-plan.md` (+ its follow-up) are recorded here as the concrete stack, with rationale tied back to the NFRs and to specific Functional Design requirements they need to satisfy.

## Application Framework — Next.js (React) + TypeScript (Q1=A)

One framework, one deployable, covering:
- Public UI (`ui/public`, per `unit-of-work.md`'s code organization)
- Admin UI (`ui/admin`)
- API routes (`api-or-routes`, per the same doc) — Next.js API routes / Route Handlers

TypeScript throughout — the Functional Design's entities (`domain-entities.md` files across all modules) translate directly into TypeScript types/interfaces, catching a class of bugs (wrong field names, mismatched enums like `Appointment.status`) at compile time rather than runtime, at no ongoing cost.

## Database — Managed PostgreSQL, serverless-friendly provider (Q2=A)

Relational, matching the FK-heavy entity design across every module (`Owner`→`Pet`, `Appointment`→`AppointmentLineItem`→`Service`, etc.). Specific provider (Neon vs. Supabase) is an Infrastructure Design decision, not fixed here — either satisfies this NFR pass's requirement. Two things the schema must get right, both already flagged in Functional Design:
- **BR-AVAIL-5 (atomic slot claims)**: implemented via a Postgres `EXCLUDE` constraint or a unique constraint on `(groomerId, slotStart)` combined with a serializable/repeatable-read transaction around the claim-check-then-insert in `claimSlot`/`forceClaimSlot` — Postgres's transactional guarantees are exactly what this rule needs; this is the main reason a NoSQL option (Q2 option C) was rejected.
- **BR-CAT-4 (price/duration snapshot)**: a plain column copy at insert time — no special DB feature needed, just discipline in the `booking` module's write path.

## Hosting — Vercel free tier (Q3=A)

Zero-config Next.js deploys, built-in Cron Jobs (feeds Q7), free tier comfortably covers 75+ appointments/week of traffic. Chosen specifically because it pairs with Q1's framework choice with no adaptation.

## Authentication — Hand-rolled, per the existing Functional Design (Q4=A, "go with recommendation")

`AuthIdentity`/`Session` (from `domain-entities.md`) implemented directly:
- Password hashing: `bcrypt` or `argon2` (standard library, not custom crypto — NFR-4's "sensible practices" bar)
- Session: an opaque token in an `httpOnly`, `Secure` cookie, no expiry claim stored server-side beyond the cookie's own browser-session lifetime (BR-AUTH-4)
- No email/SMS verification flow to build (BR-AUTH-2) — less surface area than integrating and configuring a managed provider to suppress verification would have required

This was chosen over a managed auth service specifically because BR-AUTH-1..6 already describe exact, somewhat non-default behavior (no verification, generic error messages, browser-session-only) — building it directly avoids fighting a managed provider's defaults.

## Email — Resend (Q5=A)

Transactional email for `sendBookingConfirmation`, `sendCancellationConfirmation`, and password reset (`AuthService` Flow 4). Free tier (3,000/month) comfortably covers this shop's volume (roughly 150-300 emails/month at 75-150 appointments/week accounting for confirmations + cancellations).

## SMS — Stub/log-only for now (Q6=B)

The `notification` module's SMS-sending call is implemented behind an interface (already implied by BR-NOTIF-3's "channels are independent" design) so swapping in a real provider later is a config change, not a rework. For now, SMS sends are logged (with full message content, so the "what would have been sent" is visible/testable) rather than actually dispatched. **Flagged for explicit follow-up**: enabling real SMS (recommended: Twilio, ~$5-6/month at this shop's volume) needs your (or the groomer's) sign-off before it's turned on — this is the one real recurring cost in the entire stack, everything else here fits free tiers.

## Scheduled Reminder Job — Vercel Cron (Q7=A)

A Vercel Cron Job configured to hit a secured internal API route once daily at `REMINDER_SEND_TIME` (BR-NOTIF-1's constant), running Flow 3 from `notification-business-logic-model.md` (the daily reminder batch). Free at this scale, no separate service to configure or monitor.

## Testing — Unit + integration only, no e2e in v1 (Q8=A)

- **Unit tests**: business logic and rules from every `*-business-rules.md` / `*-business-logic-model.md` — e.g. BR-AVAIL-1's sequential-duration math, BR-BOOK-6's terminal-state protection, BR-NOTIF-2's short-notice immediate-send branch
- **Integration tests**: API routes against a real (test) database — particularly the concurrency-sensitive ones (BR-AVAIL-5's atomic claim, exercised with concurrent requests)
- **Framework**: Vitest (fast, native TypeScript/ESM support, pairs naturally with Next.js) for both unit and integration tests
- No Playwright/browser e2e tests in v1 — appropriately lean for a solo-maintained project at this scale; can be added later without any rework of the app itself

## Domain & Environments — Free subdomain, single production environment (Q9=A)

`pet-groom-app.vercel.app` (or similar) until the groomer confirms real branding/domain (NFR-2's open item). No staging environment — changes are tested locally + in CI before deploying straight to production, appropriate for this scale and team size (one person). A custom domain can be pointed at the same Vercel deployment later with no code changes.

## Photo Gallery — Static images in the repo (Q10=A)

FR-12's gallery images are committed as static assets (`public/gallery/` in the Next.js convention) and served directly — no object storage service, no upload UI. Adding/changing photos requires a small code change and redeploy; acceptable given NFR-1's clean-handoff framing (the groomer contacts whoever maintains the site, or is taught the one-file-commit workflow, rather than needing self-service). Revisit if the gallery grows large or changes frequently enough that this becomes a real friction point.
