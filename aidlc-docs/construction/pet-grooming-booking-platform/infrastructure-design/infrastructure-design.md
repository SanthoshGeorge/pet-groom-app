# Infrastructure Design — Pet Grooming Booking Platform

Maps the approved tech stack and NFR design patterns to concrete infrastructure, resolving the 5 questions from `pet-grooming-booking-platform-infrastructure-design-plan.md`.

## Deployment Environment

- **Platform**: Vercel (carried forward from NFR Requirements Q3)
- **Region**: US East (Q3=A) — the standard default for US-based Vercel/Neon deployments; revisit if the groomer's actual shop location turns out to warrant a different region (no infrastructure rework needed to change it later, just a config setting)
- **Environments**: single production environment only (carried forward from NFR Requirements Q9) — no staging environment; Vercel's automatic PR preview deployments (see CI/CD below) serve as the pre-merge check instead of a persistent staging environment

## Compute Infrastructure

Carried forward, no new decision this pass: Vercel serverless functions, one per API route (Next.js convention), plus the same runtime hosting the cron-triggered reminder job (`logical-components.md`). Default function memory/timeout limits are far beyond what this shop's request volume or daily batch size would ever approach — no sizing configuration needed.

## Storage Infrastructure

- **Database**: **Neon** (Q1=A) — chosen over Supabase specifically because Supabase's bundled auth/storage/realtime features would go unused (NFR Requirements already chose hand-rolled auth and repo-committed images), so there's no reason to take on that extra surface area. Neon also has a direct first-party Vercel integration, simplifying the connection-string/environment-variable setup.
- **Connection pooling**: Neon's built-in pooled connection string (its PgBouncer-based pooler) is used for all application database access — required because serverless functions open far more connections than a traditional long-running server would, and without pooling this shop's low-but-bursty traffic pattern could still exhaust the database's direct connection limit.
- **Backups**: free-tier default backups only (Q2=A) — no point-in-time recovery add-on. Matches NFR-7's cost posture literally; revisit only if the groomer's real usage ever makes data loss a higher-stakes concern than it is for a booking system with no payment data on file.
- **Slot-uniqueness constraint**: implemented directly in the Neon database (per NFR Design's Q2/BR-AVAIL-5 resolution) — no additional infrastructure beyond the database itself.

## Messaging Infrastructure

**Not applicable** — NFR Design already decided against a message queue (`logical-components.md`'s "What was deliberately NOT added" section); `notification` sends run inline as part of the triggering request. No infrastructure to provision here.

## Networking Infrastructure

- **Load balancing / API gateway**: handled automatically by Vercel's platform — no separate infrastructure to design or provision.
- **Secrets / environment variables**: Vercel's built-in encrypted Environment Variables (Q5=A) — holds the Neon pooled connection string, the session-signing secret, the Resend API key, and the cron shared-secret (from NFR Design Q7). Scoped to the single production environment (no separate staging secrets needed, per the single-environment decision above).
- **Domain**: free Vercel subdomain for now (carried forward from NFR Requirements Q9) — e.g. `pet-groom-app.vercel.app`; DNS/custom-domain setup is deferred until the groomer confirms real branding (NFR-2), and is a config-only change when that happens (no infrastructure rework).

## Monitoring Infrastructure

Carried forward, no new decision this pass: Vercel's built-in function/request logs plus Neon's own database logs (per NFR Design Q8) — no separate error-tracking service provisioned.

## Shared Infrastructure

**Not applicable** — single-tenant deployment (one shop, one Vercel project, one Neon database). No multi-tenancy, resource isolation, or infrastructure-sharing design needed. `shared-infrastructure.md` is not generated for this reason.

## CI/CD

- **Connection**: Vercel's GitHub integration, connected directly to `SanthosGeorge/pet-groom-app` (Q4=A) — the repository already in use throughout this project.
- **Deploy trigger**: every push to `main` auto-deploys to production.
- **Preview deployments**: every pull request gets an automatic preview deployment (a Vercel feature that comes free with the GitHub integration) — useful even for a solo maintainer, since it means a change can be seen live before merging to `main`, without needing a persistent staging environment.
