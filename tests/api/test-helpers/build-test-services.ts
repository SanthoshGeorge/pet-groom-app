// Shared test-only composition root for `tests/api/**` (Code Generation Step 15).
//
// Mirrors `src/server/container.ts`'s `buildServices()` — same module wiring, same
// dependency graph — but every repository is one of Step 10's in-memory fakes
// (`tests/fakes/*.fake.ts`) instead of `container.ts`'s throwing placeholders, and
// `EmailSender`/`SmsSender` are simple in-memory trackers instead of real providers. This is
// the "real services on top of fakes" half of Step 15's documented adaptation (see
// `src/server/container.ts`'s `__setServicesForTesting` doc comment for the full
// rationale) — every module here is the REAL `createXService`, so route handlers under
// `src/app/api/**` exercise real business logic, not a stubbed-out API layer.
//
// Each call to `buildTestServices()` returns a brand-new, fully isolated set of services
// and their backing fakes — call it fresh per test (a `beforeEach`) so no state leaks
// between tests.

import { createAuthService, type AuthService } from "@/modules/auth";
import { createAvailabilityService, type AvailabilityService, type WorkingHoursRuleInput } from "@/modules/availability";
import { createBookingService, type BookingService } from "@/modules/booking";
import { createCatalogService, type CatalogService } from "@/modules/catalog";
import { createCustomerService, type CustomerService } from "@/modules/customer";
import {
  createLogOnlySmsSender,
  createNotificationService,
  type EmailMessage,
  type EmailSender,
  type NotificationService,
} from "@/modules/notification";
import { createReportingService, type ReportingService } from "@/modules/reporting";
import type { Services } from "@/server/container";

import { createFakeAuthRepository, type FakeAuthRepository } from "../../fakes/auth.fake";
import { createFakeAvailabilityRepository, everydayOpenSchedule, type FakeAvailabilityRepository } from "../../fakes/availability.fake";
import { createFakeBookingRepository, type FakeBookingRepository } from "../../fakes/booking.fake";
import { createFakeCatalogRepository, type FakeCatalogRepository } from "../../fakes/catalog.fake";
import { createFakeCustomerRepository, type FakeCustomerRepository } from "../../fakes/customer.fake";
import { createFakeNotificationRepository, type FakeNotificationRepository } from "../../fakes/notification.fake";
import { createFakeReportingRepository, type FakeReportingRepository } from "../../fakes/reporting.fake";

/** A trivial in-memory `EmailSender` that never fails and records every message sent — a
 *  real (if minimal) implementation, not a placeholder, so routes that touch `notification`
 *  actually succeed end-to-end instead of throwing like `container.ts`'s real default does. */
function createTrackingEmailSender(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

export interface TestServicesBundle {
  services: Services;
  auth: AuthService;
  customer: CustomerService;
  catalog: CatalogService;
  availability: AvailabilityService;
  booking: BookingService;
  notification: NotificationService;
  reporting: ReportingService;
  repos: {
    auth: FakeAuthRepository;
    customer: FakeCustomerRepository;
    catalog: FakeCatalogRepository;
    availability: FakeAvailabilityRepository;
    booking: FakeBookingRepository;
    notification: FakeNotificationRepository;
    reporting: FakeReportingRepository;
  };
  emailSender: EmailSender & { sent: EmailMessage[] };
  /** Convenience — opens every day 00:00-23:45 so tests don't trip over working-hours/buffer
   *  edge cases unless they explicitly want to (same rationale as booking.test.ts's own
   *  `ALL_DAY_SCHEDULE`). Call again with a narrower schedule to test hours-specific behavior. */
  setAllDayHours(): Promise<void>;
  setWorkingHours(schedule: WorkingHoursRuleInput[]): Promise<void>;
}

export async function buildTestServices(): Promise<TestServicesBundle> {
  const authRepo = createFakeAuthRepository();
  const customerRepo = createFakeCustomerRepository();
  const catalogRepo = createFakeCatalogRepository();
  const availabilityRepo = createFakeAvailabilityRepository();
  const bookingRepo = createFakeBookingRepository();
  const reportingRepo = createFakeReportingRepository();

  const customer = createCustomerService(customerRepo);
  const catalog = createCatalogService(catalogRepo);
  const availability = createAvailabilityService({ repository: availabilityRepo, catalog });
  const auth = createAuthService({ repository: authRepo, identityResolver: customer });

  const emailSender = createTrackingEmailSender();
  const notificationRepo = createFakeNotificationRepository({
    getAppointment: (id) => bookingRepo._appointments.get(id),
    onMarkFailed: (id) => bookingRepo._setNotificationFailed(id),
  });
  const notification = createNotificationService({
    repository: notificationRepo,
    customer,
    emailSender,
    smsSender: createLogOnlySmsSender(),
  });

  const booking = createBookingService({ repository: bookingRepo, customer, catalog, availability, notification });
  const reporting = createReportingService({ repository: reportingRepo });

  const services: Services = { auth, customer, catalog, availability, booking, notification, reporting };

  return {
    services,
    auth,
    customer,
    catalog,
    availability,
    booking,
    notification,
    reporting,
    repos: {
      auth: authRepo,
      customer: customerRepo,
      catalog: catalogRepo,
      availability: availabilityRepo,
      booking: bookingRepo,
      notification: notificationRepo,
      reporting: reportingRepo,
    },
    emailSender,
    async setAllDayHours() {
      await availability.setWorkingHours(everydayOpenSchedule("00:00", "23:45"));
    },
    async setWorkingHours(schedule: WorkingHoursRuleInput[]) {
      await availability.setWorkingHours(schedule);
    },
  };
}
