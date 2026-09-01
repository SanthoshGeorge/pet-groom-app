# Business Logic Model — auth / customer / catalog

**Unit**: Pet Grooming Booking Platform
**Scope**: core business logic flows for the `auth`, `customer`, and `catalog` modules. Entities referenced below are defined in `domain-entities.md`; rules referenced below (BR-*) are defined in `business-rules.md`.

---

## Flow 1: Guest/Owner Identity Resolution

Used by GC-2 (guest booking) and SO-2 (owner booking on behalf of a customer) — both call the same `createOrFindOwner` logic; `createdBy` context differs but the identity resolution is identical.

```
Input: contactInfo (name, phone, email)

1. Look up Owner by email = contactInfo.email
   -> found? reuse it, apply BR-CUST-2 field-update rule -> DONE
2. Look up Owner by phone = contactInfo.phone
   -> found? reuse it, apply BR-CUST-2 field-update rule -> DONE
3. No match -> create new Owner from contactInfo -> DONE

(BR-CUST-3 applies if steps 1 and 2 would each independently match
 a *different* existing Owner — prefer the email match.)

Output: Owner record (existing or newly created)
```

This is the same logic whether the caller is a guest customer typing their own info, or the shop owner typing a customer's info on SO-2 — `createdBy` is recorded on the resulting `Appointment` (in `booking`), not on the `Owner`.

---

## Flow 2: Account Registration (RC-1)

```
Input: email, password, (implicit: the requester's current contactInfo,
       e.g. from a just-completed guest booking or a fresh signup form)

1. Validate email not already used by an existing AuthIdentity -> reject if taken
2. Run Flow 1 (Identity Resolution) using the requester's contactInfo
   -> yields an Owner (existing, matched by BR-CUST-4's reuse of BR-CUST-1
      logic, or newly created if this is a first-time visitor signing up
      with no prior guest history)
3. Create AuthIdentity: email, passwordHash, ownerId = <Owner from step 2>,
   role = customer, verifiedAt = null (BR-AUTH-2 — active immediately)
4. Set Owner.authIdentityId = <new AuthIdentity.id>
5. Create Session for the new AuthIdentity, log the user in immediately

Output: AuthIdentity + active Session. The Owner's existing Pets (if any,
        from prior guest bookings that matched in step 2) are now visible
        under "my account" — no separate linking action needed.
```

---

## Flow 3: Login

```
Input: email, password

1. Look up AuthIdentity by email -> not found: generic "invalid credentials"
   (do not reveal whether the email exists — standard practice, not a
   formal Security Baseline requirement per NFR-4, just sensible default)
2. Verify password against passwordHash -> mismatch: same generic error
3. Create Session (BR-AUTH-4: browser-session-only, no persistent token)

Output: Session (role = customer or owner, depending on AuthIdentity.role)
```

## Flow 4: Password Recovery (BR-AUTH-3)

```
Input: email

1. Look up AuthIdentity by email
   -> not found: respond with the same generic "check your email" message
      regardless (do not reveal account existence)
2. Found: generate single-use, time-limited reset token, email it
3. On reset-token redemption with a new password:
   a. Validate token (exists, unexpired, unused)
   b. Update passwordHash
   c. Invalidate all existing Sessions for this AuthIdentity
   d. Mark token used
```

---

## Flow 5: Add/Update Pet

```
Input: ownerId, pet fields (name, breed, size, age, temperament/allergy notes)

addPet:
1. Validate ownerId exists
2. Validate size is one of the fixed categories (BR-CUST-6) -> reject if not
3. Create Pet record linked to Owner
Output: Pet record

updatePet:
1. Validate petId exists
2. Apply field changes (same size validation as above)
Output: updated Pet record

No cap on Pets per Owner (BR-CUST-5).
```

---

## Flow 6: Service Catalog Management (SO-4)

```
createService(name, price, duration):
1. Validate all three fields present (BR-CAT-5)
2. Create Service, active = true
Output: Service record

updateService(serviceId, fields):
1. Validate serviceId exists
2. Apply field changes to the *live* Service row (BR-CAT-3)
   -- no history table touched; already-booked Appointments are
      unaffected because their price/duration was already snapshotted
      at booking time (BR-CAT-4, mechanism owned by `booking`)
Output: updated Service record

deactivateService(serviceId):
1. Validate serviceId exists
2. Set active = false (BR-CAT-2 — row is never deleted)
Output: success

listActiveServices() / getService(serviceId):
- listActiveServices filters active = true (BR-CAT-1)
- getService returns any Service by id regardless of active state
  (needed so a past Appointment can still display/link to a
  deactivated service's name)
```

---

## Cross-Module Notes (for later Functional Design passes)

- `availability`'s slot-sizing will call `catalog.getService(serviceId)` for `durationMinutes` — confirmed unaffected by this pass's decisions (duration is per-service, not per-pet-size, per BR-CUST-6/Q7=A).
- `booking`'s `createBooking`/`createOverrideBooking` are the actual owners of Flow 1 (Identity Resolution) at the orchestration level — `customer.createOrFindOwner` is the primitive `booking` calls into; this pass defines the primitive's internal logic, not where it's invoked from.
- `booking`'s price/duration snapshot mechanism (BR-CAT-4) will be fully specified in the `booking` module's own Functional Design pass; this pass only establishes that `catalog` does not maintain history so `booking` must.
