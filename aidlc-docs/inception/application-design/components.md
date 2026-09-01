# Components — Pet Grooming Shop Booking App

Seven components, confirmed per application-design-plan.md (all recommended options accepted: proposed breakdown as-is, Pet as a CustomerService sub-entity, dedicated AuthService, no separate orchestrator, guest lookup inside BookingService).

---

## 1. AuthService

**Purpose**: Authenticate the shop owner and, optionally, account-holding customers.

**Responsibilities**:
- Shop owner login/session management (always required — admin actions are gated)
- Optional customer account login/session management (RC-1) — guest customers never touch this component
- Credential storage (hashed, never plaintext) and session/token issuance and validation

**Interface** (high-level; see component-methods.md for signatures): login, logout, session validation, account registration.

---

## 2. CustomerService

**Purpose**: Own owner and pet records — the shared data at the center of the whole system (FR-11).

**Responsibilities**:
- Create/update/find Owner records (name, phone, email, address, notes)
- Create/update/find Pet records as a sub-entity of Owner (name, breed/size, age, temperament notes, allergy/medical notes) — a pet has no existence independent of an owner
- Distinguish guest owners (no linked account) from account-linked owners
- Support account creation (RC-1), coordinating with AuthService for the credential side

**Interface**: CRUD for Owner and its Pets; lookup by contact info (for guest matching at booking/cancellation time) or by authenticated account.

---

## 3. CatalogService

**Purpose**: Own the service menu the shop offers.

**Responsibilities**:
- CRUD for Service records (name, price, duration) — SO-4
- Activate/deactivate services (deactivated services stop appearing as bookable but are preserved for historical appointment records, per SO-4's acceptance criteria)

**Interface**: list active services, get a service by id, create/update/deactivate a service.

---

## 4. AvailabilityService

**Purpose**: Compute open time slots and own scheduling constraints.

**Responsibilities**:
- Own groomer working hours and time-off records (SO-5)
- Compute available slots: shop hours minus existing bookings minus buffer time minus time off — slot length depends on the selected service's duration (dependency on CatalogService)
- Validate whether a specific requested slot is genuinely open **at booking time**, not just at display time (this is the check that has to be concurrency-safe — see component-dependency.md and the eventual NFR Design for how)
- Support the shop owner's override case (SO-3) — a distinct "force-claim" path that bypasses normal validation but still records the resulting conflict/flag for the calendar view

**Interface**: get available slots for a date range + service, check/claim a specific slot, force-claim a slot (owner override), release a slot (on cancellation), set working hours, add/remove time off.

---

## 5. BookingService

**Purpose**: Own the appointment lifecycle end to end — the core of the system.

**Responsibilities**:
- Create bookings for all three initiating personas: guest (GC-2), account holder (RC-2), and shop owner on behalf of a customer (SO-2) — same underlying operation, different caller context
- Support multiple pets in a single appointment (GC-2/RC-2/SO-2)
- Support the owner's override booking (SO-3) via AvailabilityService's force-claim path
- Guest appointment lookup by booking reference + contact info, for self-service cancellation without an account (GC-3)
- Cancel and reschedule appointments (GC-3, RC-3, SO-1), releasing the slot back to AvailabilityService
- Trigger NotificationService on booking creation and cancellation
- Mark appointments as past/completed so they can no longer be modified (edge case in GC-3/RC-3)

**Interface**: create a booking, create an override booking (owner only), look up a booking (guest, by reference) or list bookings (account holder or owner), cancel a booking, reschedule a booking, list all bookings (owner/admin calendar view, SO-1).

---

## 6. NotificationService

**Purpose**: Own all outbound customer communication (FR-10).

**Responsibilities**:
- Send an immediate booking confirmation via **both email and SMS** on creation, regardless of who created the booking
- Schedule and send an automated **SMS reminder 1 day before** the appointment
- Suppress a scheduled reminder if the appointment is cancelled first
- Send a cancellation confirmation

**Interface**: send booking confirmation, schedule a reminder, cancel a scheduled reminder, send cancellation confirmation.

---

## 7. ReportingService

**Purpose**: Give the shop owner basic operational visibility (SO-6).

**Responsibilities**:
- Compute appointment counts and no-show counts for a selected period, reading from BookingService's appointment data

**Interface**: get an appointment/no-show summary for a given period.
