import { NextResponse, type NextRequest } from "next/server";
import { isApiPath } from "./https";

/** Body of the 403 sent to an API call made from another site. */
export const ORIGINE_NON_CONSENTITA_MESSAGE =
  "Richiesta non consentita da questa origine.";

const METODI_SICURI = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery guard for the API, the same check Next does
 * for Server Actions: a request that changes something must come from a
 * page of this app. Browsers always send `Origin` on such requests, so a
 * form on another site (a text/plain body parses as JSON; the login needs
 * no cookie at all) is refused. Requests without `Origin` and not marked
 * cross-site by the browser (cron, scripts, server-to-server) go on: they
 * carry no victim's browser session.
 */
export function rifiutaApiDaAltraOrigine(
  request: NextRequest,
): NextResponse | null {
  if (
    METODI_SICURI.has(request.method) ||
    !isApiPath(request.nextUrl.pathname)
  ) {
    return null;
  }

  const origin = request.headers.get("origin");
  if (origin === null) {
    const sito = request.headers.get("sec-fetch-site");
    if (sito === null || sito === "same-origin" || sito === "none") return null;
  } else {
    const host = (
      request.headers.get("x-forwarded-host") ?? request.headers.get("host")
    )
      ?.split(",")[0]
      ?.trim();
    try {
      if (host && new URL(origin).host === host) return null;
    } catch {
      // `Origin: null` (sandboxed frames, some redirects): refused.
    }
  }
  return NextResponse.json(
    { error: ORIGINE_NON_CONSENTITA_MESSAGE },
    { status: 403 },
  );
}
