// Small shared helpers for `tests/api/**` — building real `Request`/`NextRequest` objects
// the same shape Next.js's router would hand a route handler.

import { NextRequest } from "next/server";

/** A JSON POST/PATCH/etc. request — mirrors what `readJsonBody` (src/server/http.ts)
 *  expects: a body that parses as a JSON object. Pass `body: undefined` to send no body at
 *  all (exercises the "not valid JSON" 400 path), or a non-object value to exercise the
 *  "not a JSON object" 400 path. */
export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** A GET request against a `NextRequest`-typed handler (e.g. `GET /api/availability`, which
 *  reads `request.nextUrl.searchParams`). */
export function nextGetRequest(url: string): NextRequest {
  return new NextRequest(new Request(url, { method: "GET" }));
}

/** A bare, non-JSON request body — used to exercise the malformed-JSON 400 path. */
export function malformedJsonRequest(url: string, method: string): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });
}
