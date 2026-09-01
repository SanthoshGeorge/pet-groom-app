# Component Methods — Pet Grooming Shop Booking App

Method signatures are language-agnostic pseudocode (the actual language/framework isn't chosen until NFR Requirements). Business rules behind each method are detailed later in Functional Design, per unit — this is interface-level only.

---

## AuthService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `login(email, password)` | credentials | session/token or error | Owner or account-holder login |
| `logout(session)` | session/token | success | End a session |
| `validateSession(session)` | session/token | identity + role (owner/customer) or invalid | Used by other components to check who's calling |
| `registerAccount(email, password, ownerId)` | credentials + existing/new owner ref | session/token | Create login for a customer opting into an account (RC-1) |

---

## CustomerService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `createOrFindOwner(contactInfo)` | name, phone, email | Owner record | Used for guest bookings — finds an existing owner by contact info or creates one |
| `getOwner(ownerId)` | owner id | Owner record + pets | Fetch full owner profile |
| `updateOwner(ownerId, fields)` | owner id + fields | updated Owner record | Edit owner details |
| `addPet(ownerId, petDetails)` | owner id, pet name/breed/size/age/notes | Pet record | Add a pet to an owner (new or existing owner) |
| `updatePet(petId, fields)` | pet id + fields | updated Pet record | Edit pet details |
| `linkAccount(ownerId, authIdentity)` | owner id, auth identity | updated Owner record | Connect a guest owner record to a new account (RC-1) |

---

## CatalogService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `listActiveServices()` | — | list of Service records | Show bookable services (public site) |
| `getService(serviceId)` | service id | Service record | Fetch one service's price/duration |
| `createService(name, price, duration)` | fields | Service record | SO-4 |
| `updateService(serviceId, fields)` | service id + fields | updated Service record | SO-4 (past appointments keep their original price) |
| `deactivateService(serviceId)` | service id | success | SO-4 — hides from booking, preserves history |

---

## AvailabilityService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `getAvailableSlots(dateRange, serviceId)` | date range, service (for duration) | list of open slots | GC-1/RC-1 display |
| `isSlotAvailable(slot, serviceId)` | slot, service | boolean | Pre-check before attempting to claim |
| `claimSlot(slot, serviceId, appointmentId)` | slot, service, appointment ref | success or "slot no longer available" error | Concurrency-safe claim at booking time (see NFR Design for the actual mechanism) |
| `forceClaimSlot(slot, serviceId, appointmentId)` | slot, service, appointment ref | success + conflict flag (if any) | Owner override (SO-3) — bypasses normal availability rules |
| `releaseSlot(appointmentId)` | appointment ref | success | Called on cancellation |
| `setWorkingHours(schedule)` | weekly schedule | success | SO-5 |
| `addTimeOff(dateRange)` | date range | success | SO-5 |

---

## BookingService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `createBooking(ownerInfo, pets[], serviceId, slot, createdBy)` | owner/guest info, one or more pets, service, requested slot, who's creating it (guest/customer/owner) | Appointment record or "slot no longer available" error | GC-2, RC-2, SO-2 — same method, different `createdBy` context |
| `createOverrideBooking(ownerInfo, pets[], serviceId, slot)` | same, owner-only | Appointment record | SO-3 |
| `lookupBooking(reference, contactInfo)` | booking reference + contact info | Appointment record or "not found" | GC-3 — guest self-service lookup, never exposes bookings that don't match |
| `listMyBookings(accountId)` | authenticated account | list of Appointment records | RC-3 |
| `listAllBookings(dateRange)` | date range, owner/admin only | list of Appointment records | SO-1 calendar view |
| `cancelBooking(appointmentId, actor)` | appointment ref, who's cancelling | success or "already occurred" error | GC-3, RC-3, SO-1 |
| `rescheduleBooking(appointmentId, newSlot)` | appointment ref, new slot | updated Appointment record or error | GC-3, RC-3 |

---

## NotificationService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `sendBookingConfirmation(appointment)` | appointment (incl. customer contact) | success/failure | FR-10 — email + SMS, immediate |
| `scheduleReminder(appointment)` | appointment | success | Schedules the 1-day-before SMS |
| `cancelScheduledReminder(appointmentId)` | appointment ref | success | Suppresses reminder on cancellation |
| `sendCancellationConfirmation(appointment)` | appointment | success/failure | GC-3/RC-3/SO-1 |

---

## ReportingService

| Method | Input | Output | Purpose |
|---|---|---|---|
| `getAppointmentSummary(period)` | date range | counts (total appointments, no-shows) | SO-6 |
