# Unit of Work Plan — Pet Grooming Shop Booking App

## Execution Checklist

- [x] Step A: Finalize unit boundaries based on answers below
- [x] Step B: Generate `unit-of-work.md` — unit definitions, responsibilities, code organization strategy
- [x] Step C: Generate `unit-of-work-dependency.md` — dependency matrix between units
- [x] Step D: Generate `unit-of-work-story-map.md` — every story mapped to a unit
- [x] Step E: Validate all 13 stories are assigned, no orphans
- [x] Step F: Present for review and approval

## Context From Application Design

`component-dependency.md` already surfaced that BookingService is the hub — it directly depends on AvailabilityService, CustomerService, NotificationService, and AuthService. That's most of the system. The two genuinely independent ("leaf") components are NotificationService and ReportingService — nothing depends on them, they just consume data.

This matters for decomposition: a hub-and-spoke dependency graph like this one doesn't parallelize well no matter how it's split — BookingService can't be meaningfully built before its dependencies exist. So the real decision here is less "how do we split this for parallel teams" (there's one builder — this session) and more "what grouping makes the per-unit Construction stages (Functional Design, NFR Requirements, etc.) manageable and non-redundant," since running NFR Requirements/NFR Design/Infrastructure Design multiple times for what will likely be one shared tech stack and one deployment is overhead, not benefit, at this scale.

---

## Questions

## Question 1 — Unit grouping
How should the 7 components be grouped into units of work?

A) **Single unit** — the whole application as one unit (recommended: matches the "monolith" definition from units-generation.md, avoids redundant NFR/Infrastructure Design passes for what will be one shared stack and one deployment anyway)

B) **Two units** — "Core Platform" (AuthService, CustomerService, CatalogService, AvailabilityService, BookingService — the tightly-coupled hub and its direct dependencies) + "Engagement" (NotificationService, ReportingService — the two independent leaf components)

C) **One unit per component** — 7 units, full granularity

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 2 — Code organization / deployment model
This is a greenfield project, so this decision shapes the directory structure Code Generation will follow later. (Note: this is about *shape* — single deployable vs. multiple — not the specific language/framework, which is still decided in NFR Requirements.)

A) **Single deployable application** with components organized as internal modules (e.g., `/lib/booking`, `/lib/availability`, etc.) — recommended, consistent with NFR-1's preference for low-maintenance managed hosting; one thing to deploy, one thing for the groomer to eventually own

B) **Multiple independently deployable services** — more operational overhead (separate deployments, inter-service calls instead of function calls), not recommended given NFR-1, but an option if you have a reason to want it

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
## Question 3 — Build order
Given BookingService depends on almost everything else, should Construction proceed in a specific dependency-respecting order, or does order not matter for this project?

A) Sequential, dependency-respecting order — foundational components first (Auth, Customer, Catalog), then Availability, then Booking, then the leaf components (Notification, Reporting) last (recommended)

B) Order doesn't matter — build in whatever order is convenient

X) Other (please describe after \[Answer\]: tag below)

\[Answer\]: A
---

**Note**: Whatever grouping is chosen, all 13 stories from `stories.md` will be explicitly mapped to a unit in `unit-of-work-story-map.md` — none can be left unassigned.
