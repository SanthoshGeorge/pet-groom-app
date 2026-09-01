# Frontend Components — auth / customer / catalog

**Unit**: Pet Grooming Booking Platform
**Scope**: component/prop/state specs (text-level, framework-agnostic — actual framework is chosen in NFR Requirements) for the UI surfaces owned by `auth`, `customer`, and `catalog`. These are the screens the mockup canvas didn't cover (it covered booking flow + admin calendar). Booking-flow components (already sketched visually in the mockup) get their own frontend-components.md when `booking` reaches Functional Design.

---

## Public site: Auth

### `LoginForm`
- **Props**: `onSuccess(session)`, `redirectTo` (optional)
- **State**: `email`, `password`, `submitting`, `error`
- **Validation**: both fields required, client-side only (real check is server-side per Flow 3)
- **Interaction**: submit -> calls `auth.login(email, password)` -> on success, store session, call `onSuccess`; on failure, show generic error message (BR-AUTH-3/Flow 3 — never reveal whether the email exists)
- **API integration**: `AuthService.login`

### `SignupForm`
- **Props**: `prefill` (optional — contact info carried over right after a guest booking, so the customer doesn't retype it), `onSuccess(session)`
- **State**: `email`, `password`, `confirmPassword`, `submitting`, `error`
- **Validation**: email format, password minimum length (exact policy set in NFR Requirements/NFR Design, not here — technology-agnostic), passwords match
- **Interaction**: submit -> `auth.registerAccount(email, password, ...)` -> immediately logged in on success (BR-AUTH-2, Flow 2) -> redirect to "my account"
- **API integration**: `AuthService.registerAccount`, internally triggers `CustomerService.createOrFindOwner`/linking (Flow 2) — component itself only calls the one auth endpoint

### `ForgotPasswordForm`
- **Props**: none
- **State**: `email`, `submitted` (boolean — show generic "check your email" confirmation regardless of match, per Flow 4)
- **Interaction**: submit -> request reset email -> always show the same confirmation state

### `ResetPasswordForm`
- **Props**: `token` (from the emailed link's URL)
- **State**: `newPassword`, `confirmPassword`, `submitting`, `error`, `success`
- **Interaction**: submit -> redeem token + set new password (Flow 4 step 3) -> on success, prompt to log in again (all prior sessions invalidated)

---

## Customer account: Pet management (RC-1, RC-2 prerequisite)

### `AccountPetsPage`
- **Props**: `ownerId` (from session)
- **State**: `pets[]` (loaded on mount), `loading`, `editingPetId` (nullable — which pet, if any, is being edited inline)
- **Children**: `PetCard` (one per pet), `AddPetForm` (shown when adding)
- **Interaction**: load via `customer.getOwner(ownerId)` -> render `pets`; "Add a pet" reveals `AddPetForm`; each `PetCard` has "Edit"/"Remove" — remove is out of scope for this pass (no `removePet` method exists in `component-methods.md`; not raised as a question, so not assumed — flagged as an open item below)
- **API integration**: `CustomerService.getOwner`, `CustomerService.addPet`, `CustomerService.updatePet`

### `PetCard`
- **Props**: `pet` (Pet record), `onEdit()`, `editable` (boolean)
- **State**: none (presentational)

### `AddPetForm` / `EditPetForm`
- **Props**: `ownerId`, `existingPet` (optional — presence means edit mode), `onSaved(pet)`, `onCancel()`
- **State**: `name`, `breed`, `size`, `age`, `temperamentNotes`, `allergyMedicalNotes`, `submitting`, `error`
- **Validation**: `name` required; `size` constrained to the fixed dropdown (`Small`/`Medium`/`Large`/`XL` — BR-CUST-6); `breed` free text, required (matches the booking-flow mockup's pet fields, which already treat breed as required free text)
- **Interaction**: submit -> `addPet` or `updatePet` depending on mode
- **API integration**: `CustomerService.addPet`, `CustomerService.updatePet`

**Open item (not one of the 9 answered questions — flagged, not assumed)**: there is no `removePet` in `component-methods.md`. If the shop owner needs to delete a mistaken/duplicate pet entry, that's either an admin-only capability (via direct data edit, FR-11's "always editable by shop owner") or a gap to raise explicitly when `customer`'s method list is revisited. Not blocking this pass since no story requires self-service pet deletion.

---

## Admin: Service management (SO-4)

### `AdminServicesPage`
- **Props**: none (admin-only route, gated by `role = owner` session)
- **State**: `services[]` (all, including inactive — admin needs to see and reactivate/manage everything), `loading`, `editingServiceId`, `showAddForm`
- **Children**: `ServiceRow` (one per service, table-style like the Admin Calendar mockup's agenda list), `ServiceForm` (shared for add/edit)
- **Interaction**: load via a full listing (admin view needs both active and inactive — `listActiveServices()` alone isn't enough here; this pass assumes an admin-scoped listing exists or is trivially derived, since `getService` + iteration or a straightforward "list all" is implied by SO-4's "existing service, when I edit..." wording — not itself one of the 9 questions, flagged as an implementation-level detail for Code Generation, not a design ambiguity)
- **API integration**: `CatalogService.getService` (per row), `CatalogService.createService`, `CatalogService.updateService`, `CatalogService.deactivateService`

### `ServiceRow`
- **Props**: `service`, `onEdit()`, `onDeactivate()`
- **State**: none (presentational)
- **Interaction**: shows a visual "inactive" badge when `active = false` (mirrors the mockup's badge pattern used for the override-flagged appointment on Admin-Calendar)

### `ServiceForm`
- **Props**: `existingService` (optional — presence means edit mode), `onSaved(service)`, `onCancel()`
- **State**: `name`, `price`, `durationMinutes`, `submitting`, `error`
- **Validation**: all three required (BR-CAT-5); `price` and `durationMinutes` numeric and positive
- **Interaction**: submit -> `createService` or `updateService`; a note in the form (static text, not a field) reminds the admin that price/duration changes only affect future bookings (BR-CAT-3)
- **API integration**: `CatalogService.createService`, `CatalogService.updateService`

### `DeactivateServiceConfirm`
- **Props**: `service`, `onConfirm()`, `onCancel()`
- **Interaction**: simple confirmation dialog before calling `deactivateService` — a destructive-feeling (though reversible-by-recreation, not by un-deactivating, since no `reactivateService` method exists either — same class of open item as `removePet` above) action deserves a confirm step
