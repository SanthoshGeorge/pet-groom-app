# Logical Components — Pet Grooming Booking Platform

Infrastructure-adjacent components introduced or confirmed by NFR Design, on top of the application modules already defined in Functional Design (`auth`, `customer`, `catalog`, `availability`, `booking`, `notification`, `reporting`).

## Cron-Triggered Reminder Job

- **Trigger**: Vercel Cron, configured to call a dedicated API route once daily at `REMINDER_SEND_TIME` (BR-NOTIF-1)
- **Protection (Q7=A)**: the route checks a shared-secret header (an environment-variable token configured in both Vercel Cron's settings and the app) and rejects any request missing or mismatching it — prevents the endpoint from being triggered by anyone who discovers the URL
- **Logic executed**: `notification-business-logic-model.md`'s Flow 3 (find all `Pending` `ScheduledReminder` rows due, send, flag failures, mark `Sent`)
- **Idempotency note (not one of the 8 questions — a necessary implementation detail)**: the job should be safe to run twice for the same day (e.g. a retry after a platform hiccup) without double-sending — achieved naturally since it only processes rows still `Pending`, and marks them `Sent` as its last step per row.

## Database Constraint: Slot Uniqueness

- **What**: a unique/exclusion constraint on the `Appointment` table scoped to `(groomerId, time range)` — the concrete mechanism behind BR-AVAIL-5's atomicity guarantee (Q2=A)
- **Owner**: schema-level, created during Code Generation's database migration, not application code
- **Consumed by**: `availability`'s `claimSlot`/`forceClaimSlot` (the insert attempt + caught-violation pattern from `nfr-design-patterns.md`)

## Session Store

- **What**: `Session` rows in the same Postgres database (no separate session store like Redis) — an opaque token in an `httpOnly` cookie references a `Session` row looked up on each authenticated request
- **Why no separate store**: at this scale, one more service (Redis) to provision and pay for/manage buys nothing over a database lookup that's already fast; keeps the "everything in one managed Postgres instance" story simple for NFR-1's low-maintenance goal

## Logging (Q8=A)

- **What**: Vercel's built-in function/request logs, plus the database provider's own query/error logs — no separate error-tracking service
- **What gets logged**: unhandled exceptions (platform default), plus explicit application logs for every `notificationFailed` occurrence (BR-NOTIF-4) and every slot-claim constraint-violation catch (so a pattern of failed claims — e.g. a UI bug repeatedly trying stale slots — would be visible in logs even though it's not surfaced as a user-facing error state)
- **Revisit trigger**: if the shop's usage grows enough that "grep through platform logs" stops being practical, or if a second developer joins the project, Sentry's free tier (Q8's Option B) is a low-effort upgrade path — nothing in this design precludes adding it later.

## What was deliberately NOT added

Naming these explicitly so a future reader (including a later Claude session resuming this project) doesn't wonder if they were forgotten:
- **No message queue** — `notification` calls (email/SMS) happen inline as part of the request that triggers them (booking creation, cancellation), not queued for background processing. At this volume, inline is fast enough and simpler to reason about; BR-NOTIF-3 already ensures a slow/failed send doesn't block the booking response the customer is waiting on.
- **No circuit breaker** for the email/SMS providers — unnecessary given BR-NOTIF-3's design (failures are independent, non-blocking, and not retried), which already achieves what a circuit breaker would add for a system this size.
- **No API gateway / rate limiter infrastructure** — consistent with Q6=B (no rate limiting in v1); the app's own API routes are the only entry point.
- **No CDN/caching layer beyond what the hosting platform provides automatically** — Vercel's own edge caching for static assets (the photo gallery images, Q10 of NFR Requirements) applies with zero configuration; no additional caching infrastructure was designed on top.
