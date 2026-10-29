import type { NextRequest } from "next/server";
import { enforceHttps } from "@/lib/security/https";
import { rifiutaApiDaAltraOrigine } from "@/lib/security/origine";
import { updateSession } from "@/lib/supabase/proxy";
import { rewriteTappaNonTrovata } from "@/lib/tappe/visibile";

export async function proxy(request: NextRequest) {
  // Plain-HTTP requests are redirected before any session work happens.
  const https = enforceHttps(request);
  if (https) return https;
  // API calls that change something only from this app's pages (CSRF).
  const altraOrigine = rifiutaApiDaAltraOrigine(request);
  if (altraOrigine) return altraOrigine;
  // Drafts and unknown stages: a real 404 before the page streams (BLVS-24).
  return (await rewriteTappaNonTrovata(request)) ?? updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation; everything else refreshes the session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
