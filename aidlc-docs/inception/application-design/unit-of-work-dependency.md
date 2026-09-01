# Unit of Work Dependencies — Pet Grooming Shop Booking App

## Inter-Unit Dependencies

**N/A** — there is only one unit of work (Pet Grooming Booking Platform), so there are no inter-unit dependencies to coordinate, no deployment ordering between units, and no version-compatibility concerns between separately-deployed pieces. This is a direct consequence of Question 1's answer (single unit).

## Intra-Unit (Module) Dependencies

The dependency relationships that *do* matter are between the modules inside this one unit — these are the same relationships already captured in `component-dependency.md`, carried forward here as the basis for internal build order:

| Module | Depends On | Build Order Position |
|---|---|---|
| `auth` | `customer` (registration links to an owner) | 1 — foundational |
| `customer` | `auth` (account linking) | 1 — foundational |
| `catalog` | none | 1 — foundational |
| `availability` | `catalog` (service duration) | 2 |
| `booking` | `availability`, `customer`, `notification`, `auth` | 3 — core, built after its dependencies |
| `notification` | none | built alongside `booking` (consumed by it) |
| `reporting` | `booking` (reads appointment data) | 4 — last |

This matches the build order documented in `unit-of-work.md`.

## Why Single-Unit Was the Right Call Here

`component-dependency.md` showed `booking` depending on 4 of the other 6 modules directly. Any multi-unit split would have put `booking` in a unit that couldn't start until nearly everything else was done anyway — so splitting would add coordination overhead (separate NFR/Infrastructure Design passes, inter-unit contracts) without enabling any real parallel work. Single-unit, dependency-ordered internal build, is the leaner path for a system shaped like this one.
