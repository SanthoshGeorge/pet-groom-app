# Personas — Pet Grooming Shop Booking App

## 1. Guest Customer

**Who they are**: A pet owner who wants to book a grooming appointment without creating an account. May be a first-time customer or someone who just doesn't want to manage a login.

**Goals**:
- Find an open appointment time quickly
- Book without friction — minimal required info
- Be able to cancel/reschedule without calling the shop

**Pain points this system addresses**:
- Not wanting to create an account just to book a single appointment
- Uncertainty about whether a time slot is actually available
- No way today to self-serve a cancellation

**Technical comfort**: Assume low to moderate — should not require anything beyond filling a simple web form.

---

## 2. Returning Customer

**Who they are**: A pet owner who grooms with this shop regularly and has (or wants) a saved account so they don't have to re-enter their pet's details every visit.

**Goals**:
- Book faster by reusing saved pet/owner info
- Keep pet details (allergies, temperament notes) accurate and available to the groomer automatically
- See their own upcoming appointment(s) and manage them

**Pain points this system addresses**:
- Re-typing the same pet details every time they book
- No record connecting them to their pet's grooming history

**Technical comfort**: Assume low to moderate, same as Guest Customer, plus comfortable creating a simple account (email/password or similar).

---

## 3. Shop Owner (Groomer / Admin)

**Who they are**: The groomer who runs the shop day-to-day — currently a single person doing both the grooming and the administration. Books walk-ins and phone-in requests on behalf of customers, and needs to manage the business side (services, hours, pricing).

**Goals**:
- See the full schedule at a glance
- Book or adjust appointments for customers who call, walk in, or can't use the site themselves
- Occasionally override normal availability for a walk-in or special case
- Keep service list, prices, and working hours current without needing technical help
- Get a basic sense of business volume (appointments/week, no-shows)

**Pain points this system addresses**:
- No central place today to see all bookings
- No way to hold a slot for someone who calls or walks in
- No visibility into weekly volume or no-show patterns

**Technical comfort**: Assume low — admin actions must be as simple as the customer-facing booking flow. This persona is also the one taking over long-term maintenance (per NFR-1), so clarity matters more than power-user features.

---

## Persona-to-Story Mapping

| Story | Guest Customer | Returning Customer | Shop Owner |
|---|---|---|---|
| View available times | ✓ | ✓ | ✓ (via calendar) |
| Book an appointment (guest) | ✓ | | |
| Create/use an account | | ✓ | |
| Book an appointment (account holder) | | ✓ | |
| Cancel/reschedule own appointment | ✓ | ✓ | |
| Book an appointment on behalf of a customer | | | ✓ |
| Book outside normal availability (override) | | | ✓ |
| View and manage the full calendar | | | ✓ |
| Manage services and prices | | | ✓ |
| Manage working hours | | | ✓ |
| View basic reports | | | ✓ |
