/**
 * POST /api/auth/reset-password
 *
 * Auth: none (public) — authorization is possession of a valid reset token.
 * Body: { token, newPassword }.
 * Response: 200 { message }. Does not log the caller in or set a session cookie.
 * Errors: 400 missing fields or invalid/expired token.
 */
// POST /api/auth/reset-password — Flow 4, step 3. BR-AUTH-3: invalidates every one of the
// identity's existing sessions on success (auth/service.ts). This route does NOT log the
// caller back in or set a session cookie — they're expected to log in fresh with the new
// password afterward; no story requires the reverse.

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";

interface ResetPasswordRequestBody {
  token: string;
  newPassword: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<ResetPasswordRequestBody>(request);
    if (!body.token || !body.newPassword) {
      throw new HttpError(400, "token and newPassword are required");
    }

    const { auth } = getServices();
    await auth.resetPassword(body.token, body.newPassword);

    return jsonOk({ message: "Password has been reset. Please log in with your new password." });
  } catch (err) {
    return errorToResponse(err);
  }
}
