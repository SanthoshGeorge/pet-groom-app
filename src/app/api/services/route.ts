// GET /api/services — FR-1 catalog browsing. BR-CAT-1: only `active = true` (bookable)
// services are returned, via `catalog.listActiveServices()`.

import { getServices } from "@/server/container";
import { errorToResponse, jsonOk } from "@/server/http";

export async function GET() {
  try {
    const { catalog } = getServices();
    const services = await catalog.listActiveServices();
    return jsonOk({ services });
  } catch (err) {
    return errorToResponse(err);
  }
}
