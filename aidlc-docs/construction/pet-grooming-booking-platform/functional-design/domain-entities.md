# Domain Entities — auth / customer / catalog

**Unit**: Pet Grooming Booking Platform
**Scope**: entities owned by the `auth`, `customer`, and `catalog` modules. `Appointment` (owned by `booking`) and slot/availability structures (owned by `availability`) are referenced but not defined here — they get their own domain-entities coverage in later Functional Design passes.

## Entity Summary

| Entity | Owning Module | Purpose |
|---|---|---|
| `AuthIdentity` | auth | A login credential (email + password) for an account holder |
| `Session` | auth | An active logged-in session, customer or owner |
| `Owner` | customer | A pet owner / customer — guest or account-linked |
| `Pet` | customer | A pet belonging to an Owner |
| `Groomer` | customer | A groomer/staff member (minimal, per FR-2 and Q6=A) |
| `Service` | catalog | A bookable grooming service with current price/duration |

## AuthIdentity

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `email` | string | unique, used for login |
| `passwordHash` | string | never store plaintext (NFR-4 general good practice) |
| `ownerId` | id (FK -> Owner) | the Owner record this login is linked to (1:1) |
| `role` | enum: `customer` \| `owner` | shop owner's admin login is also an AuthIdentity, but with `role = owner` and no linked Owner record — see BR-AUTH-6 |
| `createdAt` | timestamp | |
| `verifiedAt` | timestamp, nullable | not used in v1 (Q3=A: accounts are active immediately) — field reserved so email verification can be added later without a schema change |

**Relationships**: `AuthIdentity.ownerId -> Owner.id` (one AuthIdentity per Owner, optional — most Owners have none, since booking as guest never requires one).

## Session

| Field | Type | Notes |
|---|---|---|
| `id` / `token` | id | session identifier (opaque token, not the primary key exposed to clients) |
| `authIdentityId` | id (FK -> AuthIdentity) | who's logged in |
| `role` | enum: `customer` \| `owner` | denormalized from AuthIdentity for fast checks |
| `createdAt` | timestamp | |
| `expiresAt` | timestamp, nullable | v1: no fixed expiry is stored — the session cookie itself is non-persistent (browser-session-only, per Q5=A); field reserved for a future "remember me" option |

## Owner

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `name` | string | required |
| `phone` | string | required (FR-3, FR-11) |
| `email` | string | required (FR-3, FR-11) |
| `address` | string, optional | FR-11 |
| `notes` | string, optional | shop-owner-facing notes, FR-11 |
| `authIdentityId` | id (FK -> AuthIdentity), nullable | set once this Owner links or creates an account (RC-1); null for guest-only owners |
| `createdAt` | timestamp | |

**Relationships**: `Owner 1 --- * Pet`. `Owner 1 --- 0..1 AuthIdentity`.

## Pet

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `ownerId` | id (FK -> Owner) | required |
| `name` | string | required |
| `breed` | string | free text (Q7=A — too many breeds/mixes to enumerate) |
| `size` | enum: `Small` \| `Medium` \| `Large` \| `XL` | fixed category (Q7=A — reserved for future duration-by-size logic; not used by any v1 business rule) |
| `age` | number (years), optional | FR-11 |
| `temperamentNotes` | string, optional | FR-11 |
| `allergyMedicalNotes` | string, optional | FR-11 |
| `createdAt` | timestamp | |

## Groomer

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `name` | string | required |
| `active` | boolean | default true |
| `createdAt` | timestamp | |

**Note (Q6=A — minimal)**: `Groomer` has no linked `AuthIdentity` in v1. Every `Appointment` (owned by `booking`) references a `Groomer` (auto-assigned per FR-2, since only one exists today), but no one logs in *as* a groomer — the shop owner's single `role = owner` login covers all admin actions, including ones performed "for" a groomer. This keeps the schema ready for FR-2/NFR-3's future growth (more groomers, groomer-specific logins) without requiring a groomer-login feature now.

## Service

| Field | Type | Notes |
|---|---|---|
| `id` | id | primary key |
| `name` | string | required |
| `price` | decimal | current price — FR-1 |
| `durationMinutes` | integer | current duration — FR-1, used by `availability` for slot sizing |
| `active` | boolean | default true; `false` = deactivated (SO-4), hidden from booking, preserved for history |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Note (Q8=A — no separate history log)**: `Service` holds only the *current* price/duration. When an appointment is booked, `booking` copies the price/duration onto the `Appointment` record as a **snapshot** at booking time (see `business-rules.md` BR-CAT-4). This satisfies "past appointments keep their original price" (SO-4) without a separate price-history table. `updatedAt` alone is not an audit trail — if the groomer later wants a full change history, that's a v2 addition, not a schema break (adding a `ServicePriceHistory` table wouldn't require touching `Service` or `Appointment`).

## Entity Relationship Diagram (text)

```
AuthIdentity (0..1) ------ (1) Owner (1) ------ (0..*) Pet
     |
     | role=owner: no linked Owner
     |
   Session (many, one active login can have multiple sessions e.g. two browser tabs)

Groomer (standalone in this module group — referenced by Appointment in `booking`, not defined here)

Service (standalone — referenced by Appointment in `booking` via a price/duration snapshot, not a live FK for price purposes)
```
