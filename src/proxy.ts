import type { NextRequest } from "next/server";
import { enforceHttps } from "@/lib/security/https";
import { rifiutaApiDaAltraOrigine } from "@/lib/security/origine";
import { updateSession } from "@/lib/supabase/proxy";
import {
  controllaTappa,
  rewriteGironeDemoNonTrovato,
} from "@/lib/tappe/visibile";

export async function proxy(request: NextRequest) {
  // Plain-HTTP requests are redirected before any session work happens.
  const https = enforceHttps(request);
  if (https) return https;
  // API calls that change something only from this app's pages (CSRF).
  const altraOrigine = rifiutaApiDaAltraOrigine(request);
  if (altraOrigine) return altraOrigine;
  // Drafts, unknown stages and unknown groups: a real 404 before the page
  // streams (BLVS-24). A «tappa di prova» is checked with the session.
  const tappa = await controllaTappa(request);
  if (tappa.esito === "nonTrovata") return tappa.risposta;
  return (
    rewriteGironeDemoNonTrovato(request) ??
    (tappa.esito === "conSessione"
      ? updateSession(request, { controllaPagina: tappa.controllaPagina })
      : updateSession(request))
  );
}

export const config = {
  matcher: [
    // Skip static assets, image optimisation and the web app manifest (fetched
    // without a session: a login redirect would hide the home-screen icon);
    // everything else refreshes the session.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
