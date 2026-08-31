# User Stories — Pet Grooming Shop Booking App

Organized by persona, ordered as a journey (discover → book → manage) within each. All stories follow INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable). Acceptance criteria use Given/When/Then; key edge cases are called out explicitly per the approved plan.

---

## Guest Customer

### GC-1: View available appointment times
**As a** guest customer, **I want to** see which appointment times are open **so that** I can pick one that works for me without calling the shop.

**Acceptance Criteria**:
- Given the public booking page, when I select a service, then I see a calendar/list of open time slots for the next several days.
- Given a time slot is already booked, when I view availability, then that slot does not appear as open.
- Given the shop is closed on a given day, when I view availability, then no slots appear for that day.
- **Edge case**: Given two customers load the availability page at the same time, when both view the same slot, then the slot shows as open to both until one of them completes a booking — the system does not falsely show it as taken preemptively.

### GC-2: Book an appointment as a guest
**As a** guest customer, **I want to** book an appointment by providing my contact and pet details **so that** I don't need to create an account.

**Acceptance Criteria**:
- Given an open time slot, when I select it and enter my name, phone, email, and pet details (name, breed, size, notes), then the appointment is created and I receive a confirmation via email and SMS.
- Given I want grooming for more than one of my pets in the same visit, when I add additional pets to the same booking, then all pets are included in a single appointment.
- Given I omit a required field (e.g., phone), when I try to submit, then I see a clear error and the booking is not created.
- **Edge case**: Given another customer books the same slot a moment before I submit, when I try to confirm, then I see a message that the slot is no longer available and I'm shown updated availability — I am not double-booked into the same slot as someone else.

### GC-3: Cancel or reschedule a guest appointment
**As a** guest customer, **I want to** cancel or reschedule my appointment myself **so that** I don't have to call the shop.

**Acceptance Criteria**:
- Given a confirmation email/SMS with a booking reference, when I use it to look up my appointment, then I can cancel or reschedule it to another open slot.
- Given I cancel, when the cancellation completes, then the slot becomes available to others and I receive a cancellation confirmation.
- There is no cutoff window — I can cancel/reschedule at any time before the appointment, including shortly before it.
- **Edge case**: Given I try to cancel an appointment that has already occurred, when I attempt it, then the system tells me it can no longer be modified rather than silently failing or erroring.
- **Edge case**: Given I enter an incorrect booking reference or mismatched contact info, when I try to look up an appointment, then I cannot view or modify someone else's booking.

---

## Returning Customer

### RC-1: Create or use an account
**As a** returning customer, **I want to** optionally create an account **so that** I don't have to re-enter my pet's details every time I book.

**Acceptance Criteria**:
- Given I've booked before as a guest or I'm a new customer, when I choose to create an account, then my contact and pet details are saved for future bookings.
- Given I have an account, when I log in, then I see my saved pet(s) and can reuse their details when booking.
- An account is never required to book — this story only applies to customers who opt in.

### RC-2: Book an appointment using saved details
**As a** returning customer, **I want to** book using my saved pet and contact info **so that** booking is faster than starting from scratch.

**Acceptance Criteria**:
- Given I'm logged in, when I start a booking, then my saved pet(s) and contact details are pre-filled.
- Given I want to add a new pet not yet on file, when I add it during booking, then it's saved to my account for future use.
- Given I want grooming for more than one saved pet in the same visit, when I select multiple pets, then all are included in a single appointment (same as GC-2).
- **Edge case**: Given another customer books the same slot a moment before I submit, when I try to confirm, then I see the same "slot no longer available" behavior as GC-2.

### RC-3: Cancel or reschedule an appointment
**As a** returning customer, **I want to** cancel or reschedule my upcoming appointment(s) from my account **so that** I don't have to call the shop.

**Acceptance Criteria**:
- Given I'm logged in, when I view my upcoming appointments, then I can cancel or reschedule any of them, with no cutoff window (same as GC-3).
- **Edge case**: Given an appointment has already occurred, when I view my appointment list, then it's shown as past/completed and cannot be cancelled or rescheduled.

---

## Shop Owner

### SO-1: View and manage the full appointment calendar
**As the** shop owner, **I want to** see all upcoming appointments in one place **so that** I know my schedule at a glance.

**Acceptance Criteria**:
- Given I'm logged into the admin view, when I open the calendar, then I see all booked appointments (guest and account-holder) with customer, pet(s), service, and time.
- Given I select an appointment, when I view its details, then I can see or edit the customer/pet notes relevant to that visit.
- Given I want to cancel any appointment (not just ones I created), when I do so, then it's removed from the calendar and the customer is notified.

### SO-2: Book an appointment on behalf of a customer
**As the** shop owner, **I want to** create a booking for a customer who calls or walks in **so that** I can serve customers who aren't using the site themselves.

**Acceptance Criteria**:
- Given a customer's info (new or existing), when I create a booking on their behalf, then it's created the same way a self-service booking would be, including support for multiple pets in one visit.
- Given the customer is new, when I enter their and their pet's details during booking, then a new owner/pet record is created for future use.
- Given the customer already exists, when I search for them, then I can find and reuse their saved info rather than re-entering it.

### SO-3: Book outside normal availability
**As the** shop owner, **I want to** book a walk-in or special-case appointment even outside normal computed availability **so that** I'm not blocked by the same constraints customers face.

**Acceptance Criteria**:
- Given a time slot that would normally be unavailable (outside hours, inside a buffer window, etc.), when I book it from the admin view, then the system allows it and clearly flags it as an override in the calendar.
- Given an override would conflict with an already-booked appointment, when I attempt it, then I see a warning about the conflict but can still confirm if I choose to (owner discretion, not blocked).

### SO-4: Manage services and prices
**As the** shop owner, **I want to** add, edit, or remove services and their prices **so that** the booking site reflects what I actually offer.

**Acceptance Criteria**:
- Given the service management screen, when I add a new service with a name, price, and duration, then it becomes bookable on the public site.
- Given an existing service, when I edit its price or duration, then future bookings reflect the update (past appointments are unaffected).
- Given a service I want to stop offering, when I deactivate it, then it no longer appears as bookable but historical appointments referencing it are preserved.

### SO-5: Manage working hours and availability
**As the** shop owner, **I want to** set my working hours and time off **so that** customers only see times I'm actually available.

**Acceptance Criteria**:
- Given the availability settings, when I set my regular weekly hours, then customer-visible availability (GC-1) reflects those hours.
- Given I need a day or block of time off, when I mark it as unavailable, then no new bookings can be made in that window, and existing appointments in that window are flagged for me to address.

### SO-6: View basic reports
**As the** shop owner, **I want to** see basic numbers about my appointments **so that** I understand how the business is doing.

**Acceptance Criteria**:
- Given the reports view, when I open it, then I see appointment counts for the current week/month and a no-show count.
- Given I select a different time period, when I change it, then the numbers update accordingly.

---

## Summary

- **13 stories** total: 3 Guest Customer, 3 Returning Customer, 6 Shop Owner (organized as one distinct override story per the approved plan)
- All stories are coarse-grained (one per capability) with Given/When/Then acceptance criteria
- Key edge cases (double-booking races, canceling past appointments, mismatched guest lookups, override conflicts) are embedded directly in the relevant stories' criteria, not deferred
