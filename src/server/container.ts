// Composition root — constructs every business-logic module's service instance.
//
// WHY THIS FILE EXISTS (read before touching service construction anywhere else)
// --------------------------------------------------------------------------------
// Prisma's CLI cannot run in this build environment (egress to binaries.prisma.sh is
// blocked), so `@prisma/client` has no generated types anywhere in this codebase, and the
// real, database-backed repository implementations for all 7 modules — Code Generation
// Phase F, Step 17 ("Repository Layer Generation") — do not exist yet.
//
// Every module's business logic (`src/modules/*/service.ts`) already depends only on its
// own repository *interface* (`src/modules/*/repository.ts`), never on Prisma directly, so
// it compiles and unit-tests fine (Steps 3-10) without a real database. But the API routes
// built starting at this step (Phase D, Step 12) need actual, constructed service instances
// to call into (`booking.createBooking(...)`, `auth.login(...)`, etc.). This file is the one
// place that resolves that gap: it builds each `createXService(...)` using a **placeholder
// repository** — a generic `Proxy` (see `createPlaceholderRepository` below) whose every
// method throws a descriptive "not wired to a database yet" error instead of touching
// Postgres. That lets every route in this codebase compile, type-check, and be called
// (`getServices()`) against the REAL service interfaces right now — routes never see or
// import a placeholder directly, only the service instances `getServices()` hands back.
//
// Consequence, called out explicitly (this is a real execution-level decision this step
// makes, not something an earlier stage pinned down — the same category as the Prisma-ORM
// choice the Code Generation plan itself already flags): none of the routes built in this
// step can be exercised end-to-end against real data yet. Calling any repository method
// throws at runtime until Step 17 replaces the placeholder construction below with a real
// Prisma-backed one. `npx next build`'s type-checking (not a runtime smoke test) is Step
// 12's correctness signal for that reason — see the Code Generation plan, Phase E (Steps
// 15-16), which itself only becomes meaningful once Step 17 is done.
//
// WHAT STEP 17 ACTUALLY CHANGES HERE: swap each
// `createPlaceholderRepository<XRepository>("X")` call below for a real
// `createPrismaXRepository(prisma)` (or similar) constructor call. Nothing else in this
// file, and NOTHING in any route handler under `src/app/api/`, needs to change — every
// route already calls through `getServices()` against the same service interfaces either
// way.
//
// The same placeholder treatment is used for `notification`'s `EmailSender` — there's no
// real Resend wiring yet either (no `RESEND_API_KEY` usage exists anywhere in this codebase
// yet; that's a separate, still-open piece of work, not scoped to Step 17's repository work
// specifically). SMS already has a real (log-only, per Q6=B) implementation,
// `createLogOnlySmsSender` — only email needs a placeholder.

import {
  createAuthService,
  type AuthRepository,
  type AuthService,
} from "@/modules/auth";
import {
  createAvailabilityService,
  type AvailabilityRepository,
  type AvailabilityService,
} from "@/modules/availability";
import {
  createBookingService,
  type BookingRepository,
  type BookingService,
} from "@/modules/booking";
import {
  createCatalogService,
  type CatalogRepository,
  type CatalogService,
} from "@/modules/catalog";
import {
  createCustomerService,
  type CustomerRepository,
  type CustomerService,
} from "@/modules/customer";
import {
  createLogOnlySmsSender,
  createNotificationService,
  type EmailSender,
  type NotificationRepository,
  type NotificationService,
} from "@/modules/notification";
import {
  createReportingService,
  type ReportingRepository,
  type ReportingService,
} from "@/modules/reporting";

/**
 * Builds a `Proxy`-based stand-in for a repository interface `T`: every method call throws
 * a descriptive "not wired yet" error instead of touching a database. One generic function
 * — rather than a hand-written stub object per module, each requiring its own list of
 * methods kept in sync with that module's `repository.ts` — keeps this file short and,
 * more importantly, keeps the *only* thing Step 17 has to change per module to the single
 * one-line call-site swap described in the header comment above.
 */
function createPlaceholderRepository<T extends object>(moduleLabel: string): T {
  return new Proxy(
    {},
    {
      get(_target: object, prop: string | symbol) {
        if (typeof prop !== "string") return undefined;
        return async () => {
          throw new Error(
            `${moduleLabel}Repository.${prop} is not yet wired to a database — the real ` +
              'Prisma-backed repository is implemented in Code Generation Step 17 ' +
              '("Repository Layer Generation"). See src/server/container.ts\'s header comment.',
          );
        };
      },
    },
  ) as T;
}

/** See the header comment's note on `EmailSender` — no real provider is wired yet. */
function createPlaceholderEmailSender(): EmailSender {
  return {
    async send() {
      throw new Error(
        "EmailSender is not yet wired to a real provider (Resend, per tech-stack-decisions.md) " +
          "— see src/server/container.ts's header comment.",
      );
    },
  };
}

export interface Services {
  auth: AuthService;
  customer: CustomerService;
  catalog: CatalogService;
  availability: AvailabilityService;
  booking: BookingService;
  notification: NotificationService;
  // Added in Step 13 (Admin API routes) for `GET /api/admin/reports` — Step 12 didn't need
  // it (no public route calls `reporting`), so it wasn't in `getServices()` yet. Built
  // against the same `createPlaceholderRepository<T>` pattern as every other module above;
  // Step 17 swaps it for a real Prisma-backed `ReportingRepository` the same way.
  reporting: ReportingService;
}

let servicesSingleton: Services | null = null;

function buildServices(): Services {
  const customer = createCustomerService(createPlaceholderRepository<CustomerRepository>("Customer"));

  const catalog = createCatalogService(createPlaceholderRepository<CatalogRepository>("Catalog"));

  const availability = createAvailabilityService({
    repository: createPlaceholderRepository<AvailabilityRepository>("Availability"),
    catalog,
  });

  const auth = createAuthService({
    repository: createPlaceholderRepository<AuthRepository>("Auth"),
    // `CustomerService` satisfies `OwnerIdentityResolver` structurally — no adapter needed,
    // per auth/service.ts's own header comment.
    identityResolver: customer,
  });

  const notification = createNotificationService({
    repository: createPlaceholderRepository<NotificationRepository>("Notification"),
    customer,
    emailSender: createPlaceholderEmailSender(),
    smsSender: createLogOnlySmsSender(),
  });

  const booking = createBookingService({
    repository: createPlaceholderRepository<BookingRepository>("Booking"),
    customer,
    catalog,
    availability,
    // `NotificationService` satisfies `NotificationCollaborator` structurally — no adapter
    // needed, per notification/service.ts's own header comment.
    notification,
  });

  const reporting = createReportingService({
    repository: createPlaceholderRepository<ReportingRepository>("Reporting"),
  });

  return { auth, customer, catalog, availability, booking, notification, reporting };
}

/**
 * Returns the process-wide singleton set of service instances, building them on first call.
 * Safe to memoize: every dependency constructed here is stateless business logic sitting on
 * top of a placeholder (and, from Step 17 on, a real but still-stateless Prisma-backed)
 * repository — nothing here holds per-request state. This mirrors the standard "memoized
 * Prisma client" pattern Next.js apps commonly use on Vercel, for the same warm-lambda-reuse
 * reason.
 *
 * When `__setServicesForTesting` below has installed an override, that override is returned
 * instead — see its doc comment.
 */
export function getServices(): Services {
  if (servicesOverride) {
    return servicesOverride;
  }
  if (!servicesSingleton) {
    servicesSingleton = buildServices();
  }
  return servicesSingleton;
}

// ---------------------------------------------------------------------------------------
// TEST-ONLY OVERRIDE HOOK — not part of the real runtime path.
// ---------------------------------------------------------------------------------------
// Added in Code Generation Step 15 ("API Layer Testing"). The plan's Step 15 wording calls
// for integration tests "against a test database" — there isn't one available in this
// container (Prisma client generation is blocked, egress to binaries.prisma.sh is denied),
// and the real Postgres-backed repository layer this would otherwise sit on (Step 17)
// doesn't exist yet either. Real-Postgres integration testing is explicitly Step 18's job,
// scoped to the repository layer specifically — see prisma-blocked note at the top of this
// file. The adaptation used instead: `tests/api/**` integration-tests the actual route
// handler functions (imported and invoked directly, with real `Request`/`NextRequest`
// objects) wired through THIS composition root to REAL service instances built on the same
// in-memory fake repositories Step 10's business-logic unit tests already use
// (`tests/fakes/*.fake.ts`) — exercising the full real stack (HTTP parsing, validation, auth
// gating, service composition, business logic, "persistence") short of an actual SQL
// database.
//
// Every route handler already does (and must keep doing) `import { getServices } from
// "@/server/container"` — nothing under `src/app/api/**` changes for this. Instead,
// `getServices()` itself (above) checks for an installed override first. Tests call
// `__setServicesForTesting` in a `beforeEach` and `__resetServicesForTesting` in the
// matching `afterEach`, so the real (placeholder-backed) singleton path is exactly what
// every other consumer of this module still gets by default.
//
// `overrides` may be a full `Services` object (the common case — a fresh set of fake-backed
// services per test, for isolation) or a `Partial<Services>`, in which case any module not
// supplied falls back to this file's normal placeholder-backed `buildServices()` output —
// convenient for a test that only cares about one module and is fine with every other route
// it might incidentally touch still throwing the "not wired to a database yet" placeholder
// error.
//
// Never called from anything under `src/` — this exists solely for `tests/api/**` (and, if
// Step 13/14's routes get their own suite, that suite reusing this identical mechanism).
let servicesOverride: Services | null = null;

export function __setServicesForTesting(overrides: Partial<Services> | Services): void {
  servicesOverride = { ...buildServices(), ...overrides };
}

export function __resetServicesForTesting(): void {
  servicesOverride = null;
}
