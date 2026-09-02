/**
 * POST /api/admin/bookings
 *
 * Auth: session cookie required, role=owner (401/403 otherwise).
 * Body: { ownerId? | contact?, pets: [{ petId? | newPet?, serviceId }], slotStart,
 *   visitNotes? } — exactly one of ownerId/contact; each pet exactly one of petId/newPet.
 * Response: 201 { appointment } — isOverride/hasConflict flags reflect BR-AVAIL-10 checks.
 * Errors: 400 malformed body, 401 no session, 403 non-owner session, 404 unknown
 *   owner/pet/service.
 */
// POST /api/admin/bookings — SO-3, the shop owner booking on behalf of a customer, with the
// override/conflict-warning variant (Flow 2 of booking-business-logic-model.md, BR-AVAIL-10,
// BR-BOOK-11). Owner-only. Calls `booking.createOverrideBooking`, never the plain
// `createBooking` the public `POST /api/bookings` route (Step 12) uses — that's what
// actually bypasses hours/buffer/time-off and produces the `isOverride`/`hasConflict` flags
// this route's whole reason for existing.
//
// Request body shape (documented — no earlier-stage artifact specifies a wire format; this
// mirrors `POST /api/bookings`'s shape for consistency, with `contact`/`ownerId` swapped for
// an explicit choice instead of being derived from the caller's own session, since the
// caller here is the owner booking for SOMEONE ELSE):
//   {
//     ownerId?: string,                          // book against an existing customer record
//     contact?: { name, phone, email },          // OR create/find one from contact info
//     pets: [{ petId?: string, newPet?: {...}, serviceId: string }, ...],
//     slotStart: string (ISO date-time),
//     visitNotes?: string | null
//   }
// Exactly one of `ownerId`/`contact` must be supplied — same XOR shape `pets[].petId`/
// `newPet` already uses on the public route. `createdBy` is always `"owner"` (BookingActor),
// never taken from the body — this route IS the "owner acting" path, so there's no separate
// caller-supplied value that could disagree with it.

import type { OwnerReference, PetServicePair } from "@/modules/booking";
import type { PetSize } from "@/modules/customer";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, readJsonBody } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

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

interface AdminCreateBookingRequestBody {
  ownerId?: string;
  contact?: { name: string; phone: string; email: string };
  pets: PetInput[];
  slotStart: string;
  visitNotes?: string | null;
}

function validateBody(body: AdminCreateBookingRequestBody): void {
  const hasOwnerId = typeof body.ownerId === "string" && body.ownerId.length > 0;
  const hasContact = typeof body.contact === "object" && body.contact !== null;
  if (hasOwnerId === hasContact) {
    throw new HttpError(400, "exactly one of ownerId or contact must be supplied");
  }
  if (hasContact) {
    const { name, phone, email } = body.contact as AdminCreateBookingRequestBody["contact"] as NonNullable<
      AdminCreateBookingRequestBody["contact"]
    >;
    if (!name || !phone || !email) {
      throw new HttpError(400, "contact requires name, phone, and email");
    }
  }

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

function toOwnerReference(body: AdminCreateBookingRequestBody): OwnerReference {
  if (body.ownerId) {
    return { kind: "ownerId", ownerId: body.ownerId };
  }
  // validateBody already guaranteed exactly one of ownerId/contact is present.
  return { kind: "contact", contact: body.contact! };
}

function toPetServicePairs(pets: PetInput[]): PetServicePair[] {
  return pets.map((pet) => {
    if (pet.petId) {
      return { pet: { kind: "existingPet" as const, petId: pet.petId }, serviceId: pet.serviceId };
    }
    return { pet: { kind: "newPet" as const, details: pet.newPet! }, serviceId: pet.serviceId };
  });
}

export async function POST(request: Request) {
  try {
    await requireOwnerSession();

    const body = await readJsonBody<AdminCreateBookingRequestBody>(request);
    validateBody(body);

    const { booking } = getServices();
    const appointment = await booking.createOverrideBooking({
      owner: toOwnerReference(body),
      petServicePairs: toPetServicePairs(body.pets),
      slotStart: new Date(body.slotStart),
      createdBy: "owner",
      visitNotes: body.visitNotes ?? null,
    });

    return jsonCreated({ appointment });
  } catch (err) {
    return errorToResponse(err);
  }
}
