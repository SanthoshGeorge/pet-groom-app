/**
 * POST /api/bookings
 *
 * Auth: none required. An unauthenticated caller books as guest (contact required); a
 *   role=customer session books against their own linked Owner (contact ignored).
 * Body: { contact?, pets: [{ petId? | newPet?, serviceId }], slotStart, visitNotes? }.
 * Response: 201 { appointment }.
 * Errors: 400 malformed body/missing contact, 404 unknown pet/service, 409 slot
 *   unavailable (BR-AVAIL-5/6).
 */
// POST /api/bookings — GC-2 (guest) and RC-2 (account-linked customer); both share one
// flow (`booking.createBooking`), differing only in `createdBy`/`owner` (BR-BOOK-1/8/9,
// BR-AVAIL-5/6).
//
// JUDGMENT CALL: `createdBy`/`owner` are derived from the caller's session, never taken from
// the request body. An unauthenticated caller always books as "guest" (the body's `contact`
// is required); a caller with a valid `role=customer` session always books as "account"
// against their OWN linked Owner (any `contact` in the body is ignored for that caller).
// This is the one piece of this endpoint's input that has a real trust boundary — nothing
// else here is money- or identity-shaped, per nfr-design-patterns.md's Security Patterns
// note on where extra validation care is worth spending — so it's resolved server-side, not
// left to a client-supplied field that could otherwise let a caller claim someone else's
// `ownerId`. A caller with a `role=owner` (shop-owner) session falls back to the guest path
// below: owner-on-behalf booking with the full override/conflict UX is
// `POST /api/admin/bookings` (Step 13), not this public route.
//
// Request body shape (documented — no earlier-stage artifact specifies a wire format):
//   {
//     contact?: { name, phone, email },   // required only when there's no session
//     pets: [{ petId?: string, newPet?: { name, breed, size, age?, temperamentNotes?,
//               allergyMedicalNotes? }, serviceId: string }, ...],
//     slotStart: string (ISO date-time),
//     visitNotes?: string | null
//   }
// `pets[].petId` XOR `pets[].newPet` (a flattened, friendlier shape than passing the
// internal `PetSelection` discriminated union verbatim) — translated to `PetServicePair[]`
// below.

import type { PetServicePair } from "@/modules/booking";
import type { PetSize } from "@/modules/customer";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, readJsonBody } from "@/server/http";
import { getCurrentSession } from "@/server/session";

const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];

interface NewPetInput {
  name: string;
  breed: string;
  size: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

interface PetInput {
  petId?: string;
  newPet?: NewPetInput;
  serviceId: string;
}

interface CreateBookingRequestBody {
  contact?: { name: string; phone: string; email: string };
  pets: PetInput[];
  slotStart: string;
  visitNotes?: string | null;
}

function validateBody(body: CreateBookingRequestBody): void {
  if (!Array.isArray(body.pets) || body.pets.length === 0) {
    throw new HttpError(400, "pets must be a non-empty array");
  }
  for (const pet of body.pets) {
    const hasPetId = typeof pet.petId === "string" && pet.petId.length > 0;
    const hasNewPet = typeof pet.newPet === "object" && pet.newPet !== null;
    if (hasPetId === hasNewPet) {
      throw new HttpError(400, "each pet must specify exactly one of petId or newPet");
    }
    if (hasNewPet) {
      const { name, breed, size } = pet.newPet as NewPetInput;
      if (!name || !breed) {
        throw new HttpError(400, "newPet requires name and breed");
      }
      if (!PET_SIZES.includes(size)) {
        throw new HttpError(400, `newPet.size must be one of: ${PET_SIZES.join(", ")}`);
      }
    }
    if (!pet.serviceId) {
      throw new HttpError(400, "each pet requires a serviceId");
    }
  }
  if (!body.slotStart || Number.isNaN(new Date(body.slotStart).getTime())) {
    throw new HttpError(400, "a valid slotStart is required");
  }
}

function toPetServicePairs(pets: PetInput[]): PetServicePair[] {
  return pets.map((pet) => {
    if (pet.petId) {
      return { pet: { kind: "existingPet" as const, petId: pet.petId }, serviceId: pet.serviceId };
    }
    if (pet.newPet) {
      return { pet: { kind: "newPet" as const, details: pet.newPet }, serviceId: pet.serviceId };
    }
    // Unreachable — validateBody already guaranteed exactly one of petId/newPet is present.
    throw new HttpError(400, "each pet must specify exactly one of petId or newPet");
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<CreateBookingRequestBody>(request);
    validateBody(body);

    const petServicePairs = toPetServicePairs(body.pets);
    const slotStart = new Date(body.slotStart);
    const visitNotes = body.visitNotes ?? null;

    const { booking } = getServices();
    const session = await getCurrentSession();

    if (session && session.identity.role === "customer" && session.identity.ownerId) {
      const appointment = await booking.createBooking({
        owner: { kind: "ownerId", ownerId: session.identity.ownerId },
        petServicePairs,
        slotStart,
        createdBy: "account",
        visitNotes,
      });
      return jsonCreated({ appointment });
    }

    if (!body.contact || !body.contact.name || !body.contact.phone || !body.contact.email) {
      throw new HttpError(400, "contact (name, phone, email) is required when not logged in");
    }

    const appointment = await booking.createBooking({
      owner: { kind: "contact", contact: body.contact },
      petServicePairs,
      slotStart,
      createdBy: "guest",
      visitNotes,
    });
    return jsonCreated({ appointment });
  } catch (err) {
    return errorToResponse(err);
  }
}
