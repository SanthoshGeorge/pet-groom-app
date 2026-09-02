/**
 * POST /api/auth/logout
 *
 * Auth: none required (idempotent — safe to call with no session).
 * Body: none. Clears the "session" cookie regardless of outcome.
 * Response: 200 { success: true }.
 */
// POST /api/auth/logout — idempotent (auth.logout doesn't error on an already-gone
// session, per its own doc comment). Clears the "session" cookie regardless of whether a
// token was even present.

import { getServices } from "@/server/container";
import { errorToResponse, jsonOk } from "@/server/http";
import { clearSessionCookie, getSessionToken } from "@/server/session";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      const { auth } = getServices();
      await auth.logout(token);
    }
    await clearSessionCookie();
    return jsonOk({ success: true });
  } catch (err) {
    return errorToResponse(err);
  }
}
