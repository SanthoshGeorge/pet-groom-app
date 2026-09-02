// GET /api/account/pets — RC-1: the logged-in customer's own Owner + pets.
// PATCH /api/account/pets — add a new pet (no `petId` in the body) or update an existing
// one (`petId` supplied) belonging to the logged-in customer's own Owner record. BR-CUST-5
// (no cap on pet count), BR-CUST-6 (size validated). Both require a valid `role=customer`
// session — 401 otherwise.
//
// JUDGMENT CALL: `customer.updatePet(petId, fields)` (customer/service.ts) checks only that
// the pet exists, not that it belongs to the calling Owner — a correct scope for that
// module generally, since BR-CUST-7 says owner/pet data is shop-owner-visible/editable
// regardless of account-linked status (some caller — a future admin route — is EXPECTED to
// edit any pet). This customer-facing self-service route is not that caller, so it adds its
// own ownership check here (via the already-fetched pet list from `customer.getOwner`)
// before allowing an update, rather than assuming the module enforces it for every caller.

import type { PetSize } from "@/modules/customer";
import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, jsonOk, readJsonBody } from "@/server/http";
import { getCurrentSession } from "@/server/session";

const PET_SIZES: readonly PetSize[] = ["Small", "Medium", "Large", "XL"];

interface PetRequestBody {
  petId?: string;
  name?: string;
  breed?: string;
  size?: PetSize;
  age?: number | null;
  temperamentNotes?: string | null;
  allergyMedicalNotes?: string | null;
}

async function requireOwnerId(): Promise<string> {
  const session = await getCurrentSession();
  if (!session || session.identity.role !== "customer" || !session.identity.ownerId) {
    throw new HttpError(401, "Log in to manage your pets");
  }
  return session.identity.ownerId;
}

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    const { customer } = getServices();
    const owner = await customer.getOwner(ownerId);
    if (!owner) {
      throw new HttpError(404, "Account not found");
    }
    return jsonOk({ owner });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ownerId = await requireOwnerId();
    const body = await readJsonBody<PetRequestBody>(request);
    const { customer } = getServices();

    if (body.size !== undefined && !PET_SIZES.includes(body.size)) {
      throw new HttpError(400, `size must be one of: ${PET_SIZES.join(", ")}`);
    }

    if (body.petId) {
      const owner = await customer.getOwner(ownerId);
      if (!owner || !owner.pets.some((p) => p.id === body.petId)) {
        throw new HttpError(404, "Pet not found");
      }
      const pet = await customer.updatePet(body.petId, {
        name: body.name,
        breed: body.breed,
        size: body.size,
        age: body.age,
        temperamentNotes: body.temperamentNotes,
        allergyMedicalNotes: body.allergyMedicalNotes,
      });
      return jsonOk({ pet });
    }

    if (!body.name || !body.breed || !body.size) {
      throw new HttpError(400, "name, breed, and size are required to add a pet");
    }
    const pet = await customer.addPet(ownerId, {
      name: body.name,
      breed: body.breed,
      size: body.size,
      age: body.age,
      temperamentNotes: body.temperamentNotes,
      allergyMedicalNotes: body.allergyMedicalNotes,
    });
    return jsonCreated({ pet });
  } catch (err) {
    return errorToResponse(err);
  }
}
