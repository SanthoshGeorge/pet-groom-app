// PATCH /api/admin/services/:id — SO-4, catalog management: edit a service's live fields
// (BR-CAT-3, price/duration changes never retroactively touch past appointments — see
// `catalog.updateService`'s own doc comment) or deactivate it (BR-CAT-2, soft-delete only).
// Owner-only.
//
// JUDGMENT CALL — no earlier-stage artifact specifies how "update" vs. "deactivate" are
// distinguished on the wire; this route uses one body field, `active`, to pick the call:
//   { active: false }                                   -> `catalog.deactivateService(id)`
//   { name?, price?, durationMinutes? }                  -> `catalog.updateService(id, {...})`
// `active: false` takes priority over any other fields present in the same request — there's
// no combined "edit and deactivate in one call" operation on `CatalogService` (deactivation
// only ever sets `active = false`; it doesn't take field edits), so a body mixing both is
// treated as "deactivate," matching the shape `catalog.deactivateService` actually offers,
// rather than silently dropping the other fields or picking update over deactivate. There is
// no `{ active: true }` "reactivate" operation — `CatalogService` doesn't expose one (no
// story asks for reactivating a deactivated service), so that value is rejected as a 400
// rather than silently ignored.

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

interface UpdateServiceRequestBody {
  active?: boolean;
  name?: string;
  price?: number;
  durationMinutes?: number;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerSession();
    const { id } = await params;
    const body = await readJsonBody<UpdateServiceRequestBody>(request);

    const { catalog } = getServices();

    if (body.active === false) {
      await catalog.deactivateService(id);
      const service = await catalog.getService(id);
      return jsonOk({ service });
    }

    if (body.active === true) {
      throw new HttpError(400, "reactivating a deactivated service is not supported");
    }

    if (body.name === undefined && body.price === undefined && body.durationMinutes === undefined) {
      throw new HttpError(400, "at least one of name, price, or durationMinutes is required");
    }

    const service = await catalog.updateService(id, {
      name: body.name,
      price: body.price,
      durationMinutes: body.durationMinutes,
    });

    return jsonOk({ service });
  } catch (err) {
    return errorToResponse(err);
  }
}
