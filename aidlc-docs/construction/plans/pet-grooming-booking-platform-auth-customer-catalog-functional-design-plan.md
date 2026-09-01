# Functional Design Plan — auth / customer / catalog modules

**Unit**: Pet Grooming Booking Platform (single unit, per `unit-of-work.md`)
**Scope of this pass**: the first group in the internal build order — `auth`, `customer`, `catalog` (foundational modules, no dependencies on other modules). `availability`, `booking`, `notification`, and `reporting` will each get their own Functional Design pass later, in build order.

## Plan

- [ ] Define domain entities for this group: Owner, Pet, Groomer/Staff (auth+customer), Service (catalog) — fields, relationships, identifiers
- [ ] Define business rules for guest/account owner matching and deduplication (`createOrFindOwner`)
- [ ] Define business rules for account registration and linking a guest's booking history to a new account (RC-1)
- [ ] Define auth business rules: login, session validation, session lifetime, password recovery
- [ ] Define business rules for pet records (required fields, edits, multi-pet limits)
- [ ] Define business rules for service management: create/update/deactivate, price & duration history (SO-4)
- [ ] Resolve open questions below with the user
- [ ] Decide whether frontend components are designed in this pass or deferred
- [ ] Generate `business-logic-model.md`, `business-rules.md`, `domain-entities.md`, and (if in scope) `frontend-components.md` for auth/customer/catalog

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — Owner matching / deduplication
`createOrFindOwner(contactInfo)` is used for every guest booking (GC-2) and owner-created booking (SO-2). If a new booking comes in with a name/phone/email that's close to — but not identical to — an existing owner record (e.g. same phone, different email; or same email, different phone), what should happen?

A) Match on **email only** — if the email matches an existing owner, reuse that owner record (update phone/name if changed); otherwise create a new owner

B) Match on **phone only** — same idea, keyed on phone number instead

C) Match on **email OR phone** (whichever matches first) — broadest matching, lowest chance of accidental duplicates, but small risk of merging two different people who happen to share a phone (e.g. a household landline)

D) **Never auto-match** — every guest booking creates a new owner record unless the customer is logged in; the shop owner manually merges duplicates later if needed

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: C

### Question 2 — Account registration & linking guest history (RC-1)
When a customer creates an account after previously booking as a guest, how should their past guest bookings become associated with the new account?

A) Automatic — at signup, look up existing owner records by the email/phone they register with and link automatically if found

B) Manual — the customer (or shop owner) explicitly confirms "is this you?" before linking, to avoid accidentally attaching someone else's history

C) No linking in v1 — a new account starts fresh with no pet/history carryover; the shop owner can manually add pets to the new account if needed

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 3 — Account verification at signup
Does creating an account (RC-1) require verifying the email or phone number (e.g. a confirmation link/code) before it's usable, or is the account active immediately?

A) Active immediately — no verification step (simplest for v1; matches "no payment/no accounts required" lean scope)

B) Email verification required before first login

C) Phone (SMS code) verification required before first login

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 4 — Password recovery
FR-3 says accounts are optional and password-based. What should happen when a returning customer forgets their password?

A) Standard "forgot password" email link to reset it

B) No self-service recovery in v1 — customer contacts the shop owner, who can look them up by guest info (no account needed to book anyway, so this is a low-stakes gap)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 5 — Session lifetime
How long should a login session (customer account or shop owner) last before requiring re-authentication?

A) Short-lived session (browser session only — logged out when the browser closes)

B) Persistent "remember me" style session (e.g. 30 days) unless the user explicitly logs out

C) Fixed medium duration regardless of activity (e.g. 24 hours), refreshed on use

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 6 — Groomer/staff as a first-class entity (FR-2)
FR-2 says groomers/staff should be modeled as a first-class entity (not hardcoded), even though there's only one today. For this v1 build, how much structure does that entity need?

A) Minimal — a Groomer record exists (id, name, active flag) and every appointment references one, but there's no groomer-specific login or permissions yet; the shop owner's login covers all admin actions

B) Full — each groomer gets their own login/role distinct from a separate "owner/admin" role, with different permissions, even though only one groomer exists today

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 7 — Pet record constraints
For pet records (name, breed/size, age, temperament/allergy notes — FR-11): are breed and size free-text fields, or should they be constrained to a fixed list (e.g. a size dropdown: Small/Medium/Large/XL)? This matters because AvailabilityService may eventually size appointment duration by dog size.

A) Size is a fixed small set of categories (e.g. Small/Medium/Large/XL); breed is free text (too many breeds/mixes to enumerate)

B) Both breed and size are free text; no size-based logic anywhere in v1 (duration is purely per-service, not per-dog-size, per FR-1)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 8 — Service catalog edit history (SO-4)
`updateService` says "past appointments keep their original price." Should the system keep a full history of price/duration changes per service (e.g. "Full Groom was $65 before June, $75 after"), or just enough to not retroactively change already-booked appointments?

A) Minimal — each Appointment stores a **snapshot** of the price/duration it was booked at; the Service record itself just holds the current price/duration with no separate history log

B) Full history — a separate log of every price/duration change over time, in addition to the appointment-level snapshot

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A

### Question 9 — Frontend components for this pass
This Functional Design pass covers `auth`, `customer`, and `catalog`. Their UI surfaces include: guest/account login &amp; signup, "your account" pet management, and the admin service-management screen (SO-4) — none of which have mockups yet (the mockup canvas covered the booking flow and admin calendar, not these). Should frontend component design for these screens happen now, alongside this pass, or be deferred?

A) Design them now, as part of this pass — produces `frontend-components.md` alongside the business logic docs, purely as component/prop/state specs (text, not visuals)

B) Defer all frontend component design to one later pass, after every module's business logic is done — this pass produces backend/business-logic docs only

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
