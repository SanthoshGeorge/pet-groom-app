/**
 * POST /api/admin/services
 *
 * Auth: session cookie required, role=owner (401/403 otherwise).
 * Body: { name, price, durationMinutes } — all required (BR-CAT-5).
 * Response: 201 { service }.
 * Errors: 400 missing/invalid fields, 401 no session, 403 non-owner session.
 */
// POST /api/admin/services — SO-4, catalog management: create a new bookable service.
// Owner-only. BR-CAT-5 (name/price/duration all required) is enforced by
// `catalog.createService` itself (`CatalogValidationError` -> 400); this route does the same
// lightweight presence/type check every other route in this codebase does before handing
// off to the module (see http.ts's header comment on the manual, per-route validation
// convention), rather than duplicating BR-CAT-5's exact rules here.

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, readJsonBody } from "@/server/http";
import { requireOwnerSession } from "@/server/session";

interface CreateServiceRequestBody {
  name?: string;
  price?: number;
  durationMinutes?: number;
}

export async function POST(request: Request) {
  try {
    await requireOwnerSession();

    const body = await readJsonBody<CreateServiceRequestBody>(request);
    if (!body.name || typeof body.price !== "number" || typeof body.durationMinutes !== "number") {
      throw new HttpError(400, "name, price, and durationMinutes are required");
    }

    const { catalog } = getServices();
    const service = await catalog.createService({
      name: body.name,
      price: body.price,
      durationMinutes: body.durationMinutes,
    });

    return jsonCreated({ service });
  } catch (err) {
    return errorToResponse(err);
  }
}
