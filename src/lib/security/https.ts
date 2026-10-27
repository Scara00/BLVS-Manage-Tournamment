import { NextResponse, type NextRequest } from "next/server";

/** Body of the 403 sent to API calls made over plain HTTP. */
export const HTTPS_REQUIRED_MESSAGE = "HTTPS obbligatorio.";

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
 * Handles a request that came in over plain HTTP, otherwise returns `null`.
 * Pages get a permanent redirect to the https:// URL. The API never answers
 * over HTTP: a redirect would make clients resend credentials and bodies in
 * clear, so `/api/*` gets a 403 JSON instead. Behind Vercel (or any
 * TLS-terminating proxy) the original scheme is in `x-forwarded-proto`.
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

  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: HTTPS_REQUIRED_MESSAGE },
      { status: 403 },
    );
  }

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.port = "";
  return NextResponse.redirect(url, 308);
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}
