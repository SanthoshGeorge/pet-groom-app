# Functional Design Plan — booking module

**Unit**: Pet Grooming Booking Platform (single unit, per `unit-of-work.md`)
**Scope of this pass**: the third group in the internal build order — `booking` (the hub component; depends on `availability`, `customer`, `notification`, `auth`, per `component-dependency.md`). `auth`/`customer`/`catalog` and `availability` are approved and complete. `notification`/`reporting` (the leaf group) come last.

## Plan

- [ ] Define the `Appointment` entity (and resolve the per-pet-service ambiguity below — this is the single most consequential decision in this pass, since `availability`'s already-approved slot-duration rule assumes it)
- [ ] Define appointment status lifecycle (booked, completed, cancelled, no-show) and what transitions each one
- [ ] Define business rules for reschedule (same reference vs. new one; atomicity with `availability`'s slot release/claim)
- [ ] Define business rules for cancel/reschedule scope when an appointment covers multiple pets
- [ ] Define business rules for guest lookup matching (GC-3's "cannot view someone else's booking" edge case)
- [ ] Define where visit-specific notes live (SO-1)
- [ ] Define the booking reference/confirmation number scheme (shown in the mockup as e.g. "HTG-4821")
- [ ] Resolve open questions below with the user
- [ ] Generate `business-logic-model.md`, `business-rules.md`, `domain-entities.md` for `booking` (frontend components for the booking flow were already drafted visually in the mockup canvas — Public-Booking, Public-Details, Public-Confirmation, Admin-Calendar, Admin-NewBooking — so no new `frontend-components.md` this pass unless review surfaces a gap the mockup doesn't cover)

## Questions

Please answer each question by filling in the letter choice after the `\[Answer\]:` tag. If none of the options match, choose the last option ("Other") and describe your answer.

### Question 1 — One service per booking, or one service per pet? (resolves a real conflict)
This is the most important question in this pass. Two earlier artifacts disagree with each other:
- `component-methods.md`'s `createBooking(ownerInfo, pets[], serviceId, slot, createdBy)` signature has **one** `serviceId` for the whole call.
- FR-6 says customers select "a service (**or services**, per FR-4)" — implying different pets in the same visit could get **different** services.
- `availability`'s already-approved BR-AVAIL-1 (Question 1 of that pass) used exactly that scenario as its example — one pet getting a 90-min Full Groom, another getting a 15-min Nail Trim, in the same visit, summed to a 105-min slot. That only makes sense if pets can have different services.

So which is it?

A) **Per-pet service selection** — each pet in a multi-pet visit picks its own service; the `Appointment` holds a list of (pet, service) pairs, not one service for everyone. This matches `availability`'s already-locked assumption and FR-6's "or services" wording. `createBooking`'s signature will need updating in Code Generation to take `pets[]` paired with a `serviceId` each, rather than one shared `serviceId`.

B) **One service for the whole visit** — every pet in a multi-pet booking gets the same service (e.g. all pets get "Full Groom"); `availability`'s multi-pet example was illustrative of the *sum-duration mechanism*, not a promise that services differ per pet in practice. `createBooking`'s current signature is correct as-is.

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 2 — Appointment status lifecycle and no-show marking
Stories reference appointments that are upcoming, "already occurred" (GC-3/RC-3), and no-shows (SO-6 reports a no-show count) — but `component-methods.md`'s `BookingService` has no method to mark a no-show. How should status work?

A) **Auto-complete + manual no-show flag** — once a slot's end time passes, the appointment automatically becomes "Completed"; the shop owner can separately mark it "No-show" instead (a new admin action/method not yet in `component-methods.md`, to be added now)

B) **Manual for both** — the shop owner explicitly marks each past appointment as either "Completed" or "No-show" from the admin calendar; nothing transitions automatically

C) **Auto-complete only, no no-show tracking mechanism defined here** — treat "no-show" as just a note the owner adds informally (e.g. in appointment notes), not a real status value SO-6 can count — defer real no-show tracking to a later revision

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 3 — Reschedule mechanics
`rescheduleBooking(appointmentId, newSlot)` — does rescheduling keep the same `Appointment` record (same id, same booking reference/confirmation number) with an updated slot, or does it cancel the old one and create a fresh appointment (new reference)?

A) **Same record, updated slot** — the `Appointment.id` and booking reference stay the same; only the slot (and the underlying `availability` claim — release old, claim new, both within the reschedule operation) changes. Simpler for the customer (same confirmation number still works for lookup).

B) **Cancel + recreate** — reschedule internally cancels the original appointment and creates a brand-new one with a new reference; the old one shows in history as "cancelled (rescheduled)".

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 4 — Cancel/reschedule scope for multi-pet appointments
If an `Appointment` covers two pets (one visit, e.g. Biscuit + a second dog), and the customer wants to cancel or reschedule, does that apply to the **whole visit** (both pets move/cancel together) or can they cancel/reschedule just **one pet's** part of it?

A) **Whole appointment only** — cancel/reschedule always applies to the entire visit, all pets together; there's no way to split a multi-pet appointment apart after creation. Simpler, and no story explicitly asks for partial cancellation.

B) **Per-pet within the appointment** — a customer (or owner) can cancel/reschedule one pet's portion while leaving the rest of the visit intact, which requires the `Appointment` to support partial state per pet-service line item.

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 5 — Guest lookup matching strictness (GC-3 edge case)
`lookupBooking(reference, contactInfo)` must never expose a booking to someone with the wrong contact info. How exact does the match need to be?

A) **Exact reference + exact match on phone OR email** (whichever the guest provides) — case-insensitive on email, digits-only comparison on phone (ignoring formatting like dashes/spaces/parens)

B) **Exact reference + both phone AND email must match** — stricter, but more likely to fail a legitimate customer who mistypes one field

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 6 — Where do visit-specific notes live? (SO-1)
SO-1 says the shop owner can "see or edit the customer/pet notes relevant to that visit" from an appointment's details. Is this editing the pet's permanent `temperamentNotes`/`allergyMedicalNotes` (from `customer`, carries forward to future visits), or a separate note that only applies to this one appointment?

A) **Both** — the appointment detail view shows (and lets the owner edit) the pet's permanent notes AND has its own separate `visitNotes` field on the `Appointment` for anything specific to just this booking (e.g. "customer mentioned dog seemed off today")

B) **Permanent pet notes only** — no separate per-appointment notes field; SO-1's "edit notes" just means editing the `Pet` record via `customer.updatePet`, same data every visit sees

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 7 — Booking reference / confirmation number format
The mockup shows a confirmation number like "HTG-4821" (used for GC-3's guest lookup). How should this be generated?

A) **Short random alphanumeric with a shop-initials prefix** (matches the mockup exactly — e.g. `HTG-XXXX`) — human-readable, easy to read over the phone

B) **Sequential number, no prefix** (e.g. just incrementing integers) — simplest to implement, less friendly

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
### Question 8 — Cancellation confirmation recipient when the owner cancels (SO-1)
FR-10 already establishes that booking confirmations go to the customer regardless of who created the booking. SO-1 lets the owner cancel *any* appointment. Should the same customer-always-notified pattern apply to cancellations too?

A) **Yes** — cancellation confirmation always goes to the customer, whether they cancelled it themselves or the shop owner did it on their behalf (extends FR-10's existing pattern consistently)

B) **No** — cancellation confirmations only go out when the *customer* initiates the cancellation themselves (GC-3/RC-3); an owner-initiated cancellation (SO-1) doesn't trigger an automatic notification (the owner is expected to call/text the customer directly in that case)

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A