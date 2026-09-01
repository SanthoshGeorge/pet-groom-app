# Unit of Work — Pet Grooming Shop Booking App

## Decision Summary

Per `unit-of-work-plan.md` (all recommended options accepted): this system is decomposed as **a single unit of work** — one deployable application containing all 7 components as internal modules. This is a deliberate choice, not a default: BookingService's dependencies touch nearly every other component, so splitting into multiple units would not enable real parallel work and would force redundant NFR Requirements / NFR Design / Infrastructure Design passes for what is, and should stay, one shared tech stack and one deployment.

## Unit: Pet Grooming Booking Platform

**Responsibility**: The entire booking system — public booking site, admin/owner view, and the shared data and notification logic behind both.

**Contains** (as internal modules, not separate services):
1. `auth` — AuthService
2. `customer` — CustomerService (Owner + Pet)
3. `catalog` — CatalogService
4. `availability` — AvailabilityService
5. `booking` — BookingService
6. `notification` — NotificationService
7. `reporting` — ReportingService

## Code Organization Strategy (Greenfield)

Per Question 2 (single deployable app, modules as internal folders), the recommended structure — final framework choice happens in NFR Requirements, but the shape is set now:

```
pet-groom-app/
  app-or-src/                 # exact name depends on framework chosen in NFR Requirements
    modules/
      auth/
      customer/
      catalog/
      availability/
      booking/
      notification/
      reporting/
    api-or-routes/            # thin layer calling into modules, per services.md flows
    ui/
      public/                 # customer-facing: browse, book, manage own appointment
      admin/                  # owner-facing: calendar, on-behalf booking, catalog/hours/reports
  tests/
  aidlc-docs/                 # already exists — untouched by Construction
```

Each module maps 1:1 to a component from `components.md`, so `component-methods.md`'s interfaces become each module's actual function signatures during Code Generation.

## Internal Build Order (Question 3)

Even though this is one unit (not multiple units needing sequencing between them), the *internal* module build order still matters for a sane Construction pass — later modules depend on earlier ones existing:

1. **Foundational**: `auth`, `customer`, `catalog` — no dependencies on other modules
2. **Availability**: `availability` — depends on `catalog` (service duration)
3. **Core**: `booking` — depends on `availability`, `customer`, `notification`, `auth`
4. **Leaf**: `notification`, `reporting` — built alongside/after `booking` since `booking` calls into `notification`, and `reporting` reads `booking`'s data

This order will be used to sequence Functional Design / NFR Requirements / NFR Design / Infrastructure Design / Code Generation once we're in Construction — even within a single unit, work still proceeds in this dependency order rather than randomly.
