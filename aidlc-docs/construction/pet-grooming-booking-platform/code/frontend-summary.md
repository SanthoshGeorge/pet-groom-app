# Frontend Components Summary

**Unit**: Pet Grooming Booking Platform
**Scope**: Code Generation Phase H (Frontend Components Generation, Steps 20-23) and Phase I (Frontend Components Testing, Step 24), summarized here per Step 25.

---

## What was generated (Steps 20-23)

The full Next.js App Router frontend: 18 page routes (`next build`'s route table: 38 routes total, minus the 20 API route paths already documented in `api-layer-summary.md`) across two route groups — `src/app/(public)/` (marketing/booking/auth/account, Steps 20-21) and `src/app/(admin)/` (owner-only, Step 22) — plus a stable `data-testid` on every interactive element (Step 23).

### Public site — `src/app/(public)/`

| Route | Step | Mockup coverage | Notes |
|---|---|---|---|
| `/` (home) | 20 | `Main.dc.html`, pixel-and-copy-faithful | Hero, service teaser, gallery teaser |
| `/services` | 20 | No dedicated mockup screen (only Main.dc.html's 4-card teaser) | Full catalog, "Book this service →" deep-links into `/book?serviceId=` |
| `/gallery` | 20 | No dedicated mockup screen (only Main.dc.html's 4-photo teaser) | Placeholder-photo grid (`PhotoPlaceholder`) — no real photography anywhere in the repo |
| `/about` | 20 | No mockup screen (FR-12 requirement text only) | Placeholder hours/address/phone, same NFR-2 convention the mockup itself uses |
| `/book` (`BookingWizard`) | 20 | `Public-Booking.dc.html`, `Public-Details.dc.html`, `Public-Confirmation.dc.html`, pixel-and-copy-faithful for steps 2-4 | Step 1 ("choose a service") has no mockup — the mockups only show it already-resolved; built by extending the mockup's own service-card visual language. **Judgment call**: one route with 4 steps as internal `useState`, not 4 sub-routes (flow is strictly linear, no story needs deep-linking mid-booking) |
| `/manage-booking` (`ManageBookingFlow`) | 20 | No mockup screen (GC-3's acceptance criteria + the mocked screens' shared visual language) | Guest lookup → result flow; BR-BOOK-5's generic-error message rendered verbatim, no extra branching |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | 21 | No mockup screens — built from `frontend-components.md`'s prop/state specs, first visual implementation of these screens | BR-AUTH-3's generic-error guarantee rendered verbatim throughout |
| `/account/pets` (`AccountPetsPage`, `PetForm`, `PetCard`) | 21 | No mockup screen — `frontend-components.md` spec | Shared add/edit `PetForm`, session-gated via 401-from-`GET /api/account/pets` |

### Admin site — `src/app/(admin)/`

| Route | Step | Mockup coverage | Notes |
|---|---|---|---|
| `/admin/calendar` (`AdminCalendarPage`) | 22 | `Admin-Calendar.dc.html`, pixel-for-pixel visual language | **Data gap**: `GET /api/admin/appointments` never returns denormalized owner/pet names (confirmed against `booking`'s types/repository), so rows show the booking reference + resolved service name(s) instead of the mockup's "Jamie Rivera · Biscuit" line — an upstream API-shape limitation, not a shortcut. Day strip extended to all 7 days (working hours are admin-configurable, SO-5) and given real week prev/next navigation (mockup only ever shows one static week) |
| `/admin/bookings/new` (`NewBookingPage`) | 22 | `Admin-NewBooking.dc.html`, card/toggle/slot styling read from that artboard | Mockup's live customer-search box isn't buildable (no `list-customers` endpoint exists, and Step 22 must not add one) — replaced with the same effective result via `createOrFindOwner`'s existing email/phone matching. Service/pet fields are real editable inputs (mockup's were read-only, implying a prior "pick an existing pet" step this API can't support). Slot grid (normal vs. override-only) is real, computed against live `GET /api/availability` |
| `/admin/services` (`AdminServicesPage`, `ServiceForm`, `ServiceRow`, `DeactivateServiceConfirm`) | 22 | No mockup screen — `frontend-components.md` spec | **Known limitation**: reuses the public, active-only `GET /api/services` (no admin-scoped "list all including inactive" route exists); a service deactivated in an earlier session won't reappear in a fresh page load, though it's preserved server-side (BR-CAT-2) |
| `/admin/hours` (`AdminHoursPage`) | 22 | No mockup, no `frontend-components.md` spec either | Step 22's own documented fallback ("simple settings-style page") for an unspecced screen; write-only by necessity — no `GET` counterpart exists for working hours/time-off |
| `/admin/reports` (`AdminReportsPage`) | 22 | No mockup screen | Built from BR-REPORT-1..4 directly |
| `/admin` (root) | 22 | Neither mockup artboard has a bare `/admin` screen | Effectively unreachable in normal use — `AdminShell`'s nav always links into a specific page — kept only so the bare route resolves to something rather than 404ing |

**Every admin page is gated once, at `src/app/(admin)/layout.tsx`** — a server component that reads the session cookie directly (`getCurrentSession`) and redirects unauthenticated/non-owner visitors to `/login` *before* any admin markup or data reaches the browser, rather than a client-side check. See Step 24's "what's NOT covered" section below for why this specific gate isn't unit-tested at the component level.

**Automation-friendly `data-testid`s (Step 23)**: every interactive element (button, input, select, link acting as a control) carries a `data-testid` following the `{component}-{element-role}` convention (e.g. `service-form-submit-button`, `calendar-mark-no-show-button-${id}`) — confirmed throughout Step 24's component tests, which query almost exclusively by `data-testid`/`getByRole` rather than CSS selectors or text, per that convention's intent.

---

## Frontend Components Testing (Step 24)

### RTL/jsdom setup added

The project had zero DOM-testing infrastructure before this step (262 pre-existing tests, all pure business-logic/API-route tests running under Vitest's `"node"` environment). Added, additively:

**Packages installed** (`devDependencies`):
- `@testing-library/react` ^16.3.3
- `@testing-library/jest-dom` ^7.0.1
- `@testing-library/user-event` ^14.6.7
- `jsdom` ^30.0.1 (DOM environment — chosen over `happy-dom` as the more complete/standard implementation, and what `@testing-library/react`'s own docs default to)
- `@vitejs/plugin-react` ^6.1.1 (React JSX transform for the new `.tsx` test files, via Vitest's underlying Vite pipeline)

**`vitest.config.mts` changes**:
- Added `plugins: [react()]` — a no-op for every pre-existing `.ts` test file; Vite only applies the React transform to JSX-bearing files.
- Kept `test.environment: "node"` as the *default*, unchanged, for the whole suite. Each new component test file opts into `jsdom` individually via a `// @vitest-environment jsdom` pragma comment at the top of the file, rather than switching all 262 existing (non-DOM) tests to jsdom globally.
- Added `test.setupFiles: ["./tests/setup/rtl.ts"]`.
- Widened `test.include` from `*.{test,spec}.ts` to `*.{test,spec}.{ts,tsx}` so the new `.tsx` test files are actually discovered.

**New file — `tests/setup/rtl.ts`**: registered globally via `setupFiles`, so it also loads for every pre-existing module/API test. It no-ops under `typeof document === "undefined"` (the default `"node"` environment), and only inside a jsdom-environment file does it (1) extend Vitest's `expect` with jest-dom's DOM matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) via `@testing-library/jest-dom/vitest`, and (2) register an `afterEach(cleanup)` hook so one test's rendered DOM never leaks into the next — done explicitly (rather than relying on RTL's own auto-cleanup detection) because this codebase's Vitest config does not set `test.globals: true`; every test file imports `describe`/`it`/`expect`/`afterEach` from `"vitest"` explicitly.

**Judgment call**: components fetch through the project's own `_lib/api.ts` wrapper modules (`(public)/_lib/api.ts`, `(admin)/_lib/api.ts`), both thin `fetch`-based wrappers with one shared `request<T>`/`ApiError` shape. Every test file `vi.mock`s the relevant `_lib/api` module directly (via `importOriginal` + selective overrides) rather than mocking `global.fetch` — this keeps each test's setup readable (`vi.mocked(api.fetchServices).mockResolvedValue([...])` instead of hand-rolling a `fetch` response/JSON stub per call) and matches the actual seam the components themselves are written against, without needing a different mocking strategy per file.

### Test files added (64 new tests, 8 files)

| File | Category | Covers |
|---|---|---|
| `tests/components/admin/ServiceForm.test.tsx` (8 tests) | **Form validation** (BR-CAT-5) | All-empty submission (name-required), whitespace-only name, non-positive price, non-positive duration, valid submit (trims name, calls `createService`), edit mode (pre-fill + `updateService`, not `createService`), server `ApiError` surfaced, Cancel button short-circuits without validating |
| `tests/components/account/PetForm.test.tsx` (7 tests) | **Form validation** | Add mode: name/breed/size required-field chain, negative-age rejection, valid submit (`savePet` with `petId: undefined`); Edit mode: pre-fill from `existingPet`, `petId` included on save; server `ApiError` surfaced |
| `tests/components/auth/SignupForm.test.tsx` (8 tests) | **Form validation** | Name/phone required, malformed email, sub-8-char password, mismatched password/confirm, valid submit (`registerAccount` + redirect to `/account/pets` + `router.refresh()`), server `ApiError` (e.g. email-already-used) without redirecting, `prefill` prop pre-fills fields |
| `tests/components/admin/AdminCalendarPage.test.tsx` (8 tests) | **Conditional rendering** (SO-1/SO-2/SO-3, BR-NOTIF-4) | OVERRIDE / CONFLICT / FLAGGED FOR REVIEW / NOTIFICATION FAILED badges each individually present-when-true/absent-when-false, all four together, non-Booked/non-Completed status badge shown only when applicable, empty-day state |
| `tests/components/admin/NewBookingPage.test.tsx` (8 tests) | **Form validation** + **Conditional rendering** (SO-3) | Required-field chain (contact → service → pet → slot); post-booking success banner: plain "Booking confirmed" vs. the override-only note vs. the full conflict-warning heading/copy when `hasConflict`/`isOverride` combine; override toggle disabling/enabling dashed (override-only) slots |
| `tests/components/booking/BookingWizard.test.tsx` (10 tests) | **State transitions** | Step 1→2 auto-advance on service selection (gated Continue buttons), step 2→3 on slot pick, "Change" navigating step 2→1, service-change-after-slot-picked clearing the slot, full submit → step 4 confirmation, step-3 validation blocking the transition, the 409-conflict edge case resetting to step 2, multi-pet add |
| `tests/components/HeaderAuthLinks.test.tsx` (6 tests) | **State transitions** | `loading` (no flash) → `guest` (401/any rejection) vs. `customer` (resolved) branching, logout transitioning `customer` → `guest` with redirect+refresh, logout still transitioning to `guest` even if the logout call itself fails |
| `tests/components/ManageBookingFlow.test.tsx` (9 tests) | **State transitions** (GC-3) | `lookup` phase validation (reference required, email-or-phone required), `lookup` → `result` phase transition, BR-BOOK-5's generic message shown verbatim on failure, non-Booked appointments hiding cancel/reschedule actions, the cancel-confirm sub-state (open/confirm/dismiss), "look up a different booking" resetting `result` → `lookup` |

### What's deliberately NOT covered here (and why)

- **Everything already covered by Steps 15/18** — request/response shapes, admin auth-gating (401/403) on the real routes, BR-BOOK-5's byte-identical-response guarantee, repository-level atomicity (BR-AVAIL-5), and every numbered business rule at the service layer. This step mocks the `_lib/api.ts` wrapper precisely so these component tests exercise only rendering/validation/state-transition logic, not re-prove integration behavior Steps 15/18 already own.
- **`src/app/(admin)/layout.tsx`'s owner-session gate — genuine, disclosed limitation.** This is an async server component that calls `getCurrentSession()` (reads the session cookie via `next/headers`, which only works inside Next's own request-scoped execution) and `redirect()` (which works by throwing a Next-internal `NEXT_REDIRECT` value that only Next's server runtime interprets). Neither is meaningfully exercisable through `@testing-library/react`'s plain-jsdom `render()` — there's no real Next.js request/response cycle underneath it. The admin API routes' equivalent gate (`requireOwnerSession`, 401/403) is already integration-tested for real at Step 15 (`tests/api/admin-*.test.ts`); this layout is a thin, one-line wrapper around the same session helper, so the risk left uncovered is small and honestly reported here rather than papered over with a fragile mock-heavy test that would assert against Next internals instead of real behavior.
- **`DetailsStep`, `SlotStep`, `ServiceStep` in isolation** — exercised thoroughly, but only indirectly, through `BookingWizard`'s state-transition tests (which mount the real wizard and drive it through all four steps) rather than each getting its own dedicated file. This was a scope call to keep the suite focused on the plan's three named categories rather than growing a fifth file whose assertions would substantially duplicate `BookingWizard.test.tsx`'s coverage of the same DOM.
- **`LoginForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `AdminHoursPage`, `AdminReportsPage`, `AdminServicesPage`/`ServiceRow`/`DeactivateServiceConfirm`** — not given dedicated test files. `SignupForm`/`PetForm`/`ServiceForm` were judged to give the form-validation category solid, representative coverage (required fields, format checks, numeric bounds, both create and edit modes) without re-testing the same `useState`+`handleSubmit` pattern five more times; `AdminCalendarPage`'s badges and `NewBookingPage`'s conflict banner were judged the most meaningful conditional-rendering surface (the plan's own named examples); `HeaderAuthLinks`/`ManageBookingFlow`/`BookingWizard` were judged the most meaningful state-transition surfaces. This is a scope call for a **selective, representative** suite per the task's own instruction ("quality over raw count"), not a claim that the untested components have no logic worth testing.
- **Visual/pixel fidelity to the mockup canvas** (colors, spacing, exact layout) — outside RTL's scope entirely; not something a DOM-assertion test can meaningfully check. The mockup-fidelity notes documented above (and inline in each component's own header comment) are the record of that instead.

### Verification

```
npx vitest run       # 326 passed, 326 total (26 test files) — 262 pre-existing + 64 new
npx tsc --noEmit      # zero errors
npx eslint .          # zero errors, zero warnings
npx next build        # succeeds — 38 routes compiled (18 page routes + 20 API route paths, the latter already covered by Step 16's summary)
```
