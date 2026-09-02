/**
 * POST /api/auth/register
 *
 * Auth: none (public). Sets the httpOnly "session" cookie on success (logs the new account
 *   in immediately).
 * Body: { email, password, name, phone } — all required.
 * Response: 201 { identity }.
 * Errors: 400 missing fields, 409 email already used.
 */
// POST /api/auth/register — Flow 2 (RC-1). BR-AUTH-1/2/5/6, BR-CUST-4. Logs the new
// account in immediately on success (see auth/service.ts's `registerAccount` doc comment —
// Flow 2, step 5), same cookie mechanism as login.
//
// JUDGMENT CALL: the request's `email` doubles as both the login credential and the
// `ContactInfo.email` handed to `registerAccount`'s account-linking lookup (BR-CUST-4) —
// no artifact says these could ever differ for a public self-registration flow, and using
// one field for both is the natural reading of "register with your email/password."

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonCreated, readJsonBody } from "@/server/http";
import { setSessionCookie } from "@/server/session";

interface RegisterRequestBody {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<RegisterRequestBody>(request);
    if (!body.email || !body.password || !body.name || !body.phone) {
      throw new HttpError(400, "email, password, name, and phone are all required");
    }

    const { auth } = getServices();
    const { session, identity } = await auth.registerAccount(body.email, body.password, {
      name: body.name,
      phone: body.phone,
      email: body.email,
    });
    await setSessionCookie(session.id);

    return jsonCreated({ identity });
  } catch (err) {
    return errorToResponse(err);
  }
}
