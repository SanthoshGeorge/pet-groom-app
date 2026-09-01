# Business Rules — auth / customer / catalog

**Unit**: Pet Grooming Booking Platform
**Scope**: validation logic, constraints, and decision rules for the `auth`, `customer`, and `catalog` modules, per the answered Functional Design questions.

---

## Auth (AuthService)

**BR-AUTH-1 — Account creation is optional, always.**
No flow in the system requires an `AuthIdentity` to exist. Guest booking (GC-2), owner-created booking (SO-2), and lookup-by-reference (GC-3) all work without one. This is a hard constraint carried from FR-3 — no future auth rule may silently make an account mandatory.

**BR-AUTH-2 — Accounts are active immediately (Q3=A).**
`registerAccount(email, password, ownerId)` creates a usable `AuthIdentity` with no verification step. `verifiedAt` stays null in v1.

**BR-AUTH-3 — Password recovery is self-service via email (Q4=A).**
A "forgot password" request generates a single-use, time-limited reset token, emailed to the address on file. The reset link invalidates all of that identity's active sessions once used (standard practice — not separately asked, but a reasonable default consistent with "no formal security baseline" per NFR-4: simple and safe, not gold-plated).

**BR-AUTH-4 — Sessions are browser-session-only (Q5=A).**
No "remember me." A session ends when the browser is closed; there is no fixed `expiresAt` to enforce server-side beyond normal session-cookie behavior. `validateSession` treats a presented, unexpired session token as valid; there is no sliding-expiration or absolute-timeout logic to implement in v1.

**BR-AUTH-5 — Two roles only: `customer` and `owner`.**
`role = owner` is the shop owner's single admin login (there is exactly one such account in v1, created out-of-band during setup, not via public `registerAccount`). `role = customer` is a returning-customer account, always linked 1:1 to an `Owner` record via `AuthIdentity.ownerId`.

**BR-AUTH-6 — The owner login has no linked `Owner` record.**
`AuthIdentity.ownerId` is null for `role = owner`. The shop owner is staff, not a customer; SO-2's "book on behalf of a customer" flow always resolves or creates a *separate* `Owner` record for the actual customer, never reuses the owner's own login identity.

---

## Customer (CustomerService)

**BR-CUST-1 — Owner matching: email OR phone, first match wins (Q1=C).**
`createOrFindOwner(contactInfo)`:
1. Look up an existing `Owner` by exact `email` match. If found, reuse it (update `name`/`phone` if the new booking provided different values — see BR-CUST-2 for what "update" means).
2. Else look up by exact `phone` match. If found, reuse it.
3. Else create a new `Owner`.

**BR-CUST-2 — Matched-owner field updates are additive, not destructive.**
When step 1/2 above finds a match but the incoming booking has a different `name` or the *other* contact field (e.g. matched on email, but phone differs from what's on file), the system updates the `Owner` record to the latest-provided value rather than keeping the old one silently stale — a customer who moved or got a new number expects their next booking to reflect it. This is a reasonable operational default (not itself one of the 9 answered questions) rather than a blocking ambiguity; flagged here as an assumption for the shop owner to confirm once real usage surfaces a case.

**BR-CUST-3 — Ambiguous match (email and phone point to two different existing Owners): prefer the email match.**
This specific tie-break wasn't one of the 9 answered questions (Q1 covered "match on X" but not "what if X and Y disagree"). Default: email is less likely to be shared across people (a phone can be a shared household/landline number) than email, so the email match wins, and the mismatched phone is treated per BR-CUST-2 update rules. This is a documented assumption, not a user decision — flagged for confirmation if it ever produces a wrong merge in practice.

**BR-CUST-4 — Account linking at signup is automatic (Q2=A).**
`registerAccount` runs the same email-or-phone lookup as BR-CUST-1 against existing (guest) `Owner` records. If found, that `Owner` becomes linked (`Owner.authIdentityId` set) rather than creating a duplicate — the new account holder immediately sees their prior guest booking history and saved pets. If no match, a fresh `Owner` record is created and linked.

**BR-CUST-5 — Multi-pet bookings are unrestricted in count (FR-4).**
No maximum number of pets per booking is enforced in v1 business logic (none of the 9 questions raised a need for a cap; nothing in requirements.md or stories.md implies one). This is an assumption, flagged for confirmation once real usage patterns are known — a cap can be added later as a pure validation-layer change.

**BR-CUST-6 — Pet fields (Q7=A).**
`breed` is free text. `size` must be one of `Small | Medium | Large | XL` (enforced at the API/validation layer, not just the UI) — this constraint exists for future duration-by-size logic (not implemented in v1; `availability`'s duration comes purely from `Service.durationMinutes`, per FR-1).

**BR-CUST-7 — Owner/pet data is always shop-owner-visible and editable (FR-11).**
Regardless of whether an `Owner` has a linked `AuthIdentity`, the admin view can look up, view, and edit any `Owner`/`Pet` record. This is not gated by account status.

---

## Catalog (CatalogService)

**BR-CAT-1 — Only `active = true` services are bookable.**
`listActiveServices()` filters to `active = true`. Deactivated services never appear in `getAvailableSlots` or booking flows.

**BR-CAT-2 — Deactivation preserves history, does not delete (SO-4).**
`deactivateService(serviceId)` sets `active = false`. The `Service` row is never deleted — past `Appointment` records reference it (by id, for display purposes like the service name), and its price/duration snapshot already lives on those appointments per BR-CAT-4.

**BR-CAT-3 — Editing price/duration only affects future bookings (SO-4).**
`updateService(serviceId, fields)` changes the live `Service.price`/`durationMinutes` immediately. This affects: (a) what customers see going forward when browsing, and (b) what a *new* booking's snapshot will be. It does **not** retroactively change any already-created `Appointment`'s stored price/duration.

**BR-CAT-4 — Price/duration snapshot, no separate history table (Q8=A).**
At the moment `booking` creates an `Appointment` (out of scope for this pass — defined fully in the `booking` module's own Functional Design), it copies `Service.price` and `Service.durationMinutes` onto the `Appointment` record as of that instant. `Service` itself is never versioned. This is the complete mechanism satisfying "past appointments keep their original price" — no `ServicePriceHistory` entity exists in v1.

**BR-CAT-5 — Service name/price/duration are required on creation.**
`createService(name, price, duration)` requires all three; there's no draft/incomplete service state.
