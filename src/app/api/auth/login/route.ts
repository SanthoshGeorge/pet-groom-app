// POST /api/auth/login — Flow 3. BR-AUTH-4: on success, sets the httpOnly "session" cookie
// (see src/server/session.ts) with no fixed expiry (browser-session-only). Returns the
// public identity (never the password hash — `auth.login` already strips it).

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";
import { setSessionCookie } from "@/server/session";

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<LoginRequestBody>(request);
    if (!body.email || !body.password) {
      throw new HttpError(400, "email and password are required");
    }

    const { auth } = getServices();
    const { session, identity } = await auth.login(body.email, body.password);
    await setSessionCookie(session.id);

    return jsonOk({ identity });
  } catch (err) {
    return errorToResponse(err);
  }
}
