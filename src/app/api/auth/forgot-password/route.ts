// POST /api/auth/forgot-password — Flow 4, steps 1-2. BR-AUTH-3.
//
// Per auth/service.ts's own doc comment, `requestPasswordReset` deliberately resolves to
// `null` for an unknown email rather than throwing — BR-AUTH-3/Flow 4's generic-response
// guarantee is enforced HERE, at the route: this handler returns the exact same 200
// response regardless of whether the email matched an account, and never echoes the reset
// token (or whether one was generated) back in the HTTP response.
//
// KNOWN GAP (documented, not a silent omission — see this step's report): this route runs
// the real `requestPasswordReset` business logic (so a real, correctly-expiring token IS
// generated for a matching account), but does not yet actually email that token anywhere.
// Two things are missing to close this, neither in this route's scope: (1) a real
// `EmailSender` — none is wired yet, see src/server/container.ts's header comment; (2) a
// send-this-email call site — password-reset email isn't one of `NotificationService`'s
// methods (that module's scope is BR-NOTIF-1..7's appointment-lifecycle notifications only;
// BR-AUTH-3 is an `auth`-owned rule with no dedicated send method anywhere yet). Wiring
// this is expected alongside a real `EmailSender` becoming available, not part of Step 12.

import { getServices } from "@/server/container";
import { errorToResponse, HttpError, jsonOk, readJsonBody } from "@/server/http";

interface ForgotPasswordRequestBody {
  email: string;
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<ForgotPasswordRequestBody>(request);
    if (!body.email) {
      throw new HttpError(400, "email is required");
    }

    const { auth } = getServices();
    // Result (including the reset token, when one is generated) is deliberately not
    // inspected further here — see the header comment on the KNOWN GAP this reflects, and
    // on why the response below never varies by outcome.
    await auth.requestPasswordReset(body.email);

    return jsonOk({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
