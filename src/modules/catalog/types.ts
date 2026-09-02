// catalog module domain types — mirrors the `Service` model in prisma/schema.prisma.
//
// Prisma's generated client isn't available yet in this environment (Code Generation
// Step 17 wires the real Prisma-backed repository). These types are the pure-TypeScript
// shape business logic compiles against in the meantime; `price` is a plain `number`
// here even though Prisma will surface `Service.price` as a `Decimal` — the repository
// implementation (Step 17) is responsible for converting at that boundary.

/** A bookable grooming service — functional-design/domain-entities.md "Service". */
export interface Service {
  id: string;
  name: string;
  /** Current price (FR-1). Historical price lives on `AppointmentLineItem.priceSnapshot` (BR-CAT-4), owned by `booking`. */
  price: number;
  /** Current duration in minutes (FR-1) — read by `availability` for slot sizing. */
  durationMinutes: number;
  /** false = deactivated (SO-4): hidden from booking, preserved for history. */
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Input to `createService` — BR-CAT-5: all three fields are required. */
export interface CreateServiceInput {
  name: string;
  price: number;
  durationMinutes: number;
}

/** Input to `updateService` — BR-CAT-3: only the live row changes, already-booked appointments are unaffected. */
export interface UpdateServiceInput {
  name?: string;
  price?: number;
  durationMinutes?: number;
}
