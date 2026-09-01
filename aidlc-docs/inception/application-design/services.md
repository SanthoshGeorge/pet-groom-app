# Services — Orchestration Patterns

Per application-design-plan.md Q4, there is **no separate orchestration layer** — BookingService acts as the natural coordination point for booking-related flows since it already owns the appointment lifecycle, and other user-facing actions map directly to a single component. This section documents how each story's action flows through the components in `components.md`.

## Overall Pattern

A thin application/API layer (web requests from the public site or the admin view) calls directly into these domain components. No microservice-per-component assumption is implied here — whether these are modules in one deployable app or separate services is a deployment decision made later, in Infrastructure Design.

## Flow: View available times (GC-1, RC-1, SO-1 calendar)
`API layer -> AvailabilityService.getAvailableSlots(dateRange, serviceId)` (reads CatalogService's service duration internally)

## Flow: Guest books an appointment (GC-2)
```
API layer -> BookingService.createBooking(guestInfo, pets, serviceId, slot, createdBy=guest)
  BookingService -> CustomerService.createOrFindOwner(guestInfo) + addPet(...) for each pet
  BookingService -> AvailabilityService.claimSlot(slot, serviceId, appointmentId)
      -> if unavailable: return "slot no longer available" error to caller
  BookingService -> NotificationService.sendBookingConfirmation(appointment)
  BookingService -> NotificationService.scheduleReminder(appointment)
```

## Flow: Returning customer creates an account (RC-1)
```
API layer -> AuthService.registerAccount(email, password, ownerId)
  AuthService -> CustomerService.linkAccount(ownerId, authIdentity)
```

## Flow: Returning customer books using saved details (RC-2)
Same as GC-2, except `createdBy=account` and owner/pet info comes from `CustomerService.getOwner(ownerId)` (via `AuthService.validateSession`) instead of being entered fresh. Same AvailabilityService/NotificationService calls follow.

## Flow: Guest or returning customer cancels/reschedules (GC-3, RC-3)
```
Guest path:  API layer -> BookingService.lookupBooking(reference, contactInfo) -> BookingService.cancelBooking(...)
Account path: API layer -> AuthService.validateSession -> BookingService.listMyBookings(accountId) -> BookingService.cancelBooking(...)
  BookingService -> AvailabilityService.releaseSlot(appointmentId)
  BookingService -> NotificationService.cancelScheduledReminder(appointmentId)
  BookingService -> NotificationService.sendCancellationConfirmation(appointment)
```

## Flow: Shop owner books on behalf of a customer (SO-2)
```
API layer -> AuthService.validateSession (owner role required)
API layer -> BookingService.createBooking(customerInfo, pets, serviceId, slot, createdBy=owner)
  (same downstream calls as GC-2 — confirmation and reminder go to the customer, not the owner)
```

## Flow: Shop owner books outside normal availability (SO-3)
```
API layer -> AuthService.validateSession (owner role required)
API layer -> BookingService.createOverrideBooking(customerInfo, pets, serviceId, slot)
  BookingService -> AvailabilityService.forceClaimSlot(slot, serviceId, appointmentId)
  BookingService -> NotificationService.sendBookingConfirmation(appointment)
  BookingService -> NotificationService.scheduleReminder(appointment)
```

## Flow: Shop owner manages services/prices (SO-4)
`API layer -> AuthService.validateSession (owner) -> CatalogService.createService / updateService / deactivateService`

## Flow: Shop owner manages working hours (SO-5)
`API layer -> AuthService.validateSession (owner) -> AvailabilityService.setWorkingHours / addTimeOff`

## Flow: Shop owner views reports (SO-6)
`API layer -> AuthService.validateSession (owner) -> ReportingService.getAppointmentSummary(period)` (reads from BookingService's appointment data)
