import { NextResponse, type NextRequest } from "next/server";

/** HSTS policy sent on every HTTPS response when HTTPS is enforced (2 years). */
export const HSTS_HEADER_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * HTTPS is enforced on staging and production (`ENFORCE_HTTPS=true`), and is
 * off locally, in CI and in e2e, which run on plain http://localhost.
 */
export function isHttpsEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ENFORCE_HTTPS === "true";
}

/**
 * Returns a permanent redirect to the https:// URL when the request came in
 * over HTTP, otherwise `null`. Behind Vercel (or any TLS-terminating proxy)
 * the original scheme is in `x-forwarded-proto`.
 */
export function enforceHttps(request: NextRequest): NextResponse | null {
  if (!isHttpsEnforced()) return null;

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol = forwardedProto ?? request.nextUrl.protocol.replace(":", "");
  if (protocol !== "http") return null;

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url, 308);
}
