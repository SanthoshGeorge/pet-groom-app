# NFR Requirements Plan — Pet Grooming Booking Platform

**Unit**: Pet Grooming Booking Platform (single unit — this stage runs once for the whole app, not per module group)

This stage picks the actual tech stack and confirms non-functional requirements, building on the completed Functional Design (all 7 modules) and the NFRs already set in `requirements.md`:
- **NFR-1**: Santhosh builds it; the groomer takes over hosting/maintenance later — favor low/no-maintenance managed services
- **NFR-3**: 75+ appointments/week today, room for multi-location later — architecture shouldn't need a redesign, but doesn't need to be over-built for scale it doesn't have yet
- **NFR-4/NFR-5**: No formal Security or Resiliency baseline extension — sensible defaults only, not gold-plated
- **NFR-6**: No property-based testing — standard example-based tests expected
- **NFR-7**: No paid services without explicit approval — stay within free tiers where practical

## Plan

- [ ] Choose the application language/framework (single deployable app, per `unit-of-work.md`'s code organization)
- [ ] Choose the database technology (needs to support `availability`'s atomic slot-claim requirement — BR-AVAIL-5)
- [ ] Choose a hosting/deployment platform (NFR-1 low-maintenance, NFR-7 free-tier-friendly)
- [ ] Decide how auth is implemented (managed service vs. hand-rolled against the already-designed `AuthIdentity`/`Session` model)
- [ ] Choose email and SMS providers (needed by `notification`'s confirmation/reminder flows)
- [ ] Decide how the daily reminder batch job (`notification`'s BR-NOTIF-1) actually runs given the chosen hosting platform
- [ ] Choose testing frameworks (NFR-6 — standard example-based tests, unit + integration; decide if e2e is in scope for v1)
- [ ] Decide domain/environment strategy (custom domain now vs. a free hosting subdomain until the groomer confirms branding, per NFR-2; single production environment vs. staging+prod)
- [ ] Decide where photo-gallery images (FR-12) are stored/served
- [ ] Resolve open questions below with the user
- [ ] Generate `nfr-requirements.md` and `tech-stack-decisions.md`

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Application language/framework
The app is one deployable unit with API/routes + two UI surfaces (public, admin) sharing a data layer. What should it be built with?

A) **Next.js (React) + TypeScript** — one framework covers UI (both public and admin) and API routes together, matches `unit-of-work.md`'s single-app shape exactly, huge ecosystem, deploys trivially to free-tier hosts (Vercel and others) — recommended given NFR-1's low-maintenance goal and this being a hands-on learning project

B) **Separate frontend (React/Vite) + backend (Node/Express) as two deployables within the one app repo** — clearer separation of concerns, but more moving parts to deploy/maintain for a one-person handoff

C) **Something else entirely (e.g. a different language like Python/Django, or a different JS framework like SvelteKit/Remix)** — describe after \[Answer\]: tag below

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 2 — Database
Needs to support relational data (Owner/Pet/Appointment/Service, etc. — established across the Functional Design entities) and `availability`'s atomic slot-claim requirement (BR-AVAIL-5).

A) **Managed PostgreSQL on a free-tier serverless provider** (e.g. Neon or Supabase) — relational, supports the unique-constraint/transaction approach BR-AVAIL-5 needs, generous free tier at this scale (75+ appointments/week is tiny), no server to maintain (NFR-1)

B) **SQLite (file-based)** — zero external service, simplest possible setup, but doesn't suit most managed serverless hosts well (ephemeral filesystem) and complicates the low-maintenance handoff story

C) **A NoSQL document database** (e.g. MongoDB Atlas free tier) — works, but the data model here is thoroughly relational (foreign keys everywhere in the Functional Design), so this would fight the design rather than fit it

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 3 — Hosting/deployment platform
A) **Vercel free tier** — deploys Next.js (if Q1=A) with zero configuration, includes cron support for the daily reminder job (Q6), generous free tier for this scale, matches NFR-1's low-maintenance goal closely

B) **Railway or Render free/hobby tier** — also low-maintenance, slightly more general-purpose (works well regardless of framework choice), sometimes better long-running-process support

C) **Something the groomer or you already has access to / prefers** — describe after \[Answer\]: tag below

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — Auth implementation
The Functional Design already specced a custom `AuthIdentity`/`Session` model (BR-AUTH-1..6 — optional accounts, no verification, browser-session-only, generic error messages). Build it by hand, or on a managed auth service?

A) **Hand-rolled** — implement `AuthIdentity`/`Session` and the login/session logic directly as designed (password hashing via a standard library, simple session cookies) — full control, matches the Functional Design's exact rules with no adaptation needed, and the auth surface here is genuinely small (2 roles, no SSO, no verification)

B) **Managed auth service** (e.g. Supabase Auth, Auth.js/NextAuth with a credentials provider) — less code to maintain (NFR-1), but some of the already-designed rules (no verification step, generic "invalid credentials" messaging, browser-session-only expiry) may need extra configuration to match exactly rather than coming for free

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 5 — Email provider (booking confirmations, cancellations, password reset)
A) **Resend** — modern, generous free tier (3,000 emails/month), simple API, popular with the Next.js ecosystem — comfortably covers this shop's volume

B) **SendGrid** — also has a free tier, more enterprise-oriented, more setup overhead

C) **Whatever email the groomer already uses / a provider you already have an account with** — describe after \[Answer\]: tag below

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 6 — SMS provider (confirmations + day-before reminders)
Unlike email, SMS providers rarely have a meaningful free tier — this is a real recurring cost, however small, so it's worth flagging explicitly against NFR-7 ("no paid services without explicit approval").

A) **Twilio** — the standard choice, pay-per-message (roughly $0.0079/SMS in the US), no monthly minimum on pay-as-you-go; at 75 appointments/week x 2 texts each (confirmation + reminder) that's roughly $5-6/month — small but non-zero, needs your explicit sign-off per NFR-7

B) **Defer SMS to a stub/log-only implementation for now** — build the `notification` interface to support SMS, but have it just log instead of actually sending, until you/the groomer approve a real SMS budget; email confirmations still send for real

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 7 — Daily reminder batch job mechanism
`notification`'s BR-NOTIF-1 needs something to run once a day and send due reminders.

A) **Platform-native cron** (e.g. Vercel Cron Jobs, if Q3=A) — free at this scale, no extra service, ties the reminder job to the same deploy as everything else

B) **A separate free scheduled-job service** (e.g. cron-job.org hitting a secured API endpoint) — works regardless of hosting platform, one more moving part but decouples scheduling from hosting choice

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 8 — Testing scope (NFR-6 already says: standard example-based, no property-based testing)
A) **Unit + integration tests only** — cover business logic (the rules/flows from Functional Design) and API routes; no browser-automation end-to-end tests in v1 — appropriately lean for a small solo project

B) **Unit + integration + a small set of end-to-end tests** (e.g. Playwright) covering the critical paths (book an appointment, cancel, owner override) — more coverage, more to maintain

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 9 — Domain and environment strategy
A) **Free hosting subdomain for now, single production environment** — e.g. `pet-groom-app.vercel.app`, no staging environment; matches NFR-2 (no branding/domain decided yet) and keeps this simple for a one-person handoff — a custom domain can be added later with zero rework

B) **Custom domain from day one + separate staging/production environments** — more production-grade, but neither NFR-2 (no domain yet) nor the project's current scale asks for it

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 10 — Photo gallery storage (FR-12)
A) **Static images committed to the app repo, served directly** — simplest possible option, zero extra service or cost, entirely adequate for a small shop's gallery (a few dozen photos at most); re-deploy needed to add/change photos (acceptable given NFR-1's "hand off cleanly" framing — the groomer would ask you, or eventually learn to commit a file, rather than needing a self-service upload UI)

B) **A managed object storage service** (e.g. Supabase Storage, Cloudflare R2 free tier) with a simple admin upload UI — lets the groomer manage gallery photos himself without needing a code change, more setup and one more service to maintain

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]:
