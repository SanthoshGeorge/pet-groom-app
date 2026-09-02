# NFR Design Plan — Pet Grooming Booking Platform

**Unit**: Pet Grooming Booking Platform (single unit — this stage runs once for the whole app)

This stage turns the approved NFR Requirements + tech stack into concrete design patterns and logical components. Category-by-category applicability, per the mandatory evaluation:

| Category | Applicable? | Why |
|---|---|---|
| Resilience Patterns | Yes | `notification`'s no-retry decision and `availability`'s atomic-claim requirement both need a concrete pattern, not just a principle |
| Scalability Patterns | Yes, lightly | Scale is trivial (NFR-3), but `getAvailableSlots` read pattern still needs a stated approach so it isn't left implicit |
| Performance Patterns | Yes, lightly | Admin appointment lists will grow indefinitely over the shop's lifetime even at low weekly volume |
| Security Patterns | Yes | NFR-4 declined the *formal* Security Baseline extension, but "sensible practices" (already promised in `nfr-requirements.md`) still needs concrete patterns: input validation, route protection, brute-force deterrence |
| Logical Components | Yes | The cron-triggered reminder job (Q7 of NFR Requirements) is a new component whose access needs a design decision, and v1's logging/observability approach hasn't been decided yet |

## Plan

- [ ] Decide the retry pattern (if any) for failed notification sends
- [ ] Decide the concurrency-control pattern for `availability`'s atomic slot claim (BR-AVAIL-5)
- [ ] Decide whether `getAvailableSlots` reads are cached or always computed live
- [ ] Decide pagination approach for appointment-listing views
- [ ] Decide the input-validation pattern for API routes
- [ ] Decide whether login/password-reset gets basic rate limiting
- [ ] Decide how the cron-triggered reminder endpoint is protected from public misuse
- [ ] Decide the logging/observability approach for v1
- [ ] Resolve open questions below with the user
- [ ] Generate `nfr-design-patterns.md` and `logical-components.md`

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Resilience: notification retry pattern
`notification-business-rules.md`'s BR-NOTIF-4 currently has no automatic retry for failed email/SMS sends — flagged there as an open item. Now's the point to settle it.

A) **No retry, as currently designed** — a failed send just sets `notificationFailed = true` (BR-NOTIF-4) and stops; consistent with NFR-5's "no formal resiliency baseline," simplest to build and reason about

B) **One automatic retry** — on failure, wait briefly (e.g. a few seconds) and try once more before giving up and flagging; catches transient blips (a provider hiccup) without building a full retry/backoff system

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 2 — Resilience: slot-claim concurrency pattern (BR-AVAIL-5)
`tech-stack-decisions.md` named "a unique constraint or transaction" without picking one. This is the mechanism that prevents GC-1's double-booking race — worth being precise about.

A) **Database unique constraint + catch-and-report** — a unique index on `(groomerId, slotStart)` (or an overlap-excluding constraint); `claimSlot` attempts the insert directly, and a constraint violation is caught and translated into the "slot no longer available" error. Simple, and the database itself is the source of truth — no explicit locking code to get wrong.

B) **Explicit transaction with a row lock** (`SELECT ... FOR UPDATE`) — check-then-insert inside a transaction that locks the relevant time range first. More explicit control, but more code to get right, and only matters at a concurrency level this shop's scale doesn't have.

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 3 — Scalability: availability read pattern
Should `getAvailableSlots` results be cached, or always computed fresh from the database on every request?

A) **Always compute live, no caching** — at this scale (a handful of concurrent viewers at most), a live query is fast enough, and skipping caching entirely avoids any risk of showing a stale slot as open (which would just produce more claim failures, not incorrect bookings, but still worth avoiding for no real performance benefit)

B) **Short-lived cache** (e.g. a few seconds) on availability reads — reduces database load under higher traffic, adds a small amount of complexity and a very small window where displayed availability could be very slightly stale

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — Performance: pagination for appointment lists
`listAllBookings`/`listMyBookings` (from `booking-business-logic-model.md`'s Flow 6) will accumulate appointments indefinitely over the life of the shop.

A) **Paginate from the start** — both admin and customer appointment lists are paginated (or at least date-range-limited by default, e.g. "this month" for the admin calendar) from day one, avoiding a future rework once history piles up

B) **No pagination in v1** — return full result sets for now (bounded by `dateRange` parameters that already exist on `listAllBookings`); add pagination later if/when it's actually needed

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 5 — Security: input validation pattern
A) **Schema validation on every API route** (e.g. Zod schemas matching each Functional Design entity/method signature) — input is validated and parsed at the boundary before any business logic runs; catches malformed requests consistently everywhere, matches TypeScript's existing type discipline (Q1 of NFR Requirements)

B) **Manual validation per-route, no shared schema library** — less upfront structure, more likely to be inconsistent or miss a field across ~20+ API routes

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 6 — Security: rate limiting on auth endpoints
NFR-4 declined the formal Security Baseline, but hand-rolled login (Q4 of NFR Requirements) has no brute-force protection unless explicitly added.

A) **Basic rate limiting on login and password-reset-request** (e.g. a small number of attempts per IP/email per time window) — cheap to add, meaningfully raises the bar against credential-stuffing/brute-force without being a formal security program

B) **None in v1** — matches NFR-4's stated scope literally (no Security Baseline extension); the auth surface is small (2 roles, no payment data, no sensitive PII beyond pet/contact info) so the risk is low

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: B
### Question 7 — Logical component: cron endpoint protection
The daily reminder job (NFR Requirements Q7 — Vercel Cron hitting an API route) needs to not be triggerable by anyone who finds the URL.

A) **Shared-secret header** — the cron job is configured to send a secret token in a header; the endpoint checks it and rejects any request without it (Vercel Cron supports this natively) — simple, standard for this exact scenario

B) **IP allowlisting** — restrict the endpoint to Vercel's known cron IP ranges — more fragile (ranges can change) and unnecessary when option A is simpler and standard

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 8 — Logical component: logging/observability for v1
A) **Platform-native logs only** — rely on Vercel's built-in request/function logs and the database provider's own logs; no separate error-tracking service — zero additional cost or setup, adequate for a solo-maintained project at this scale (matches NFR-5/NFR-7)

B) **Add a free-tier error-tracking service** (e.g. Sentry's free tier) — catches and aggregates errors (including the `notificationFailed` cases from BR-NOTIF-4) in one place rather than requiring someone to go looking through platform logs; one more service to set up and maintain

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A