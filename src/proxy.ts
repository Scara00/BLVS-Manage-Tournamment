import type { NextRequest } from "next/server";
import { enforceHttps } from "@/lib/security/https";
import { updateSession } from "@/lib/supabase/proxy";
import { rewriteTappaNonTrovata } from "@/lib/tappe/visibile";

export async function proxy(request: NextRequest) {
  // Plain-HTTP requests are redirected before any session work happens.
  const https = enforceHttps(request);
  if (https) return https;
  // Drafts and unknown stages: a real 404 before the page streams (BLVS-24).
  return (await rewriteTappaNonTrovata(request)) ?? updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimisation; everything else refreshes the session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
