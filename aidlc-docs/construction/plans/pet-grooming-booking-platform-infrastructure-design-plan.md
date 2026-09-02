# Infrastructure Design Plan — Pet Grooming Booking Platform

**Unit**: Pet Grooming Booking Platform (single unit — this stage runs once for the whole app)

This stage maps the already-approved tech stack (`nfr-requirements/tech-stack-decisions.md`) and design patterns (`nfr-design/`) to concrete infrastructure. Much groundwork is already laid — this pass fills in the specific gaps those stages deliberately left open, and confirms the rest by carrying it forward.

Category-by-category applicability, per the mandatory evaluation:

| Category | Applicable? | Why |
|---|---|---|
| Deployment Environment | Yes | Vercel is chosen (NFR Requirements Q3), but region and the CI/CD connection to your existing GitHub repo aren't decided yet |
| Compute Infrastructure | Carried forward, no new question | Vercel serverless functions, implied directly by the Next.js framework choice (NFR Requirements Q1) — at this shop's request volume (a handful of concurrent users, small daily batch job), default function sizing/timeout limits are nowhere close to being a constraint; no sizing decision to make |
| Storage Infrastructure | Yes | `tech-stack-decisions.md` explicitly left the Postgres provider (Neon vs. Supabase) undecided — this is the right stage to settle it, plus connection pooling and backup posture |
| Messaging Infrastructure | Not applicable | NFR Design (`logical-components.md`) already explicitly decided against a message queue — notification sends run inline, synchronously, as part of the request that triggers them |
| Networking Infrastructure | Yes, lightly | Load balancing/API gateway are handled automatically by Vercel (nothing to design); secrets/environment-variable management is a real open decision |
| Monitoring Infrastructure | Carried forward, no new question | NFR Design Q8 already decided: platform-native logs only, no separate service |
| Shared Infrastructure | Not applicable | Single-tenant app (one shop, one deployment) — no multi-tenancy or infrastructure-sharing design needed |

## Plan

- [ ] Choose the specific Postgres provider (Neon vs. Supabase) and confirm connection-pooling approach for serverless functions
- [ ] Decide backup/recovery posture (free-tier default vs. a paid point-in-time-recovery add-on)
- [ ] Choose a deployment region
- [ ] Confirm the CI/CD connection (GitHub repo, branch, auto-deploy)
- [ ] Decide how secrets/environment variables are managed
- [ ] Resolve open questions below with the user
- [ ] Generate `infrastructure-design.md` and `deployment-architecture.md` (no `shared-infrastructure.md` — not applicable, single-tenant)

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Postgres provider
`tech-stack-decisions.md` named "Neon or Supabase" without picking one. Both are serverless-friendly managed Postgres with a free tier and a built-in connection pooler (needed because serverless functions open/close connections far more often than a traditional server — without pooling, this can exhaust the database's connection limit even at low traffic).

A) **Neon** — Postgres-focused, generous free tier, branching feature useful for a future staging environment if one's ever added, pairs very naturally with Vercel (Vercel has a direct Neon integration)

B) **Supabase** — also free-tier Postgres with pooling, additionally bundles auth/storage/realtime features — none of which this project needs given Q4 of NFR Requirements already chose hand-rolled auth and Q10 chose repo-committed images over object storage, so those extras would go unused

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 2 — Backup/recovery posture
A) **Free-tier default backups only** — whatever automated daily backup the chosen provider includes on its free tier (both Neon and Supabase include some form of this); matches NFR-7's "no paid services without explicit approval" literally

B) **Upgrade for point-in-time recovery (PITR)** — a paid tier feature on most providers, allows restoring to any specific moment (not just the last daily snapshot); real protection against something like an accidental bad migration, but a recurring cost NFR-7 says needs your explicit sign-off

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 3 — Deployment region
Vercel and the database provider both let you pick a region. Closer to the shop's actual customers = lower latency (though at this scale, the difference is small either way).

A) **US East** — the most common default for US-based Vercel/Neon/Supabase deployments; reasonable default absent a specific shop location

B) **A specific region matching the shop's actual location** — describe after \[Answer\]: tag below (e.g. "the shop is in California, use US West")

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — CI/CD connection
A) **Connect Vercel directly to `SanthosGeorge/pet-groom-app`** (the GitHub repo already set up and in use) — auto-deploys on every push to `main`; Vercel's GitHub integration also gives free preview deployments for pull requests, useful even solo (see a change live before merging)

B) **Manual deploys** (Vercel CLI, triggered by hand) — more control over exactly when a deploy happens, more manual steps every time

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 5 — Secrets/environment variable management
Database connection string, session-signing secret, Resend API key, cron shared-secret (NFR Design Q7), etc. all need to live somewhere.

A) **Vercel's built-in encrypted Environment Variables** — no separate service, scoped per-environment, exactly what it's designed for at this scale, zero additional cost or setup

B) **A dedicated secrets manager** (e.g. AWS Secrets Manager, Doppler) — more capability (rotation policies, audit logs), unnecessary overhead and cost for a single small app with one maintainer

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A