import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { demoDettaglioTappa } from "@/lib/demo/tappa-dettaglio";
import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * w-tappa, w-iscrizione-ok, w-live and w-girone: `/tappe/<id>`,
 * `/tappe/<id>/iscrizione`, `/tappe/<id>/live` and
 * `/tappe/<id>/gironi/<girone>`.
 */
const PAGINA_TAPPA =
  /^\/tappe\/([^/]+)(?:\/iscrizione|\/live|\/gironi\/[^/]+)?\/?$/;

/** No route matches it, so the root `not-found.tsx` answers with HTTP 404. */
export const TAPPA_NON_TROVATA_PATH = "/_tappa-non-trovata";

/** The stage id of a stage page, or null for any other path. */
export function tappaDaPercorso(pathname: string): string | null {
  const match = PAGINA_TAPPA.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * True when the stage exists and is not a draft. It reads no cookies: an
 * anonymous client sees exactly the non-draft stages (RLS `tappe_select`),
 * so a draft and a missing stage look the same. Demo data without env.
 */
export async function tappaVisibile(id: string): Promise<boolean> {
  const env = readSupabaseEnv();
  if (!env) {
    // The player calendar, or a stage created by the demo fixtures.
    const stato =
      demoDettaglioTappa(id)?.stato ?? getDemoTappaGestione(id)?.row.stato;
    return stato !== undefined && stato !== "bozza";
  }
  if (!isUuid(id)) return false;
  const anon = createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon
    .from("tappe")
    .select("id")
    .eq("id", id)
    .neq("stato", "bozza")
    .maybeSingle();
  // On a database error let the page decide (it shows the 503 boundary).
  if (error) return true;
  return data !== null;
}

/**
 * Proxy step: a page of a draft or of a stage that does not exist is
 * rewritten to an unmatched path, so it answers a real HTTP 404 (w-404)
 * before any rendering. In the page itself the status would already be
 * committed to 200: Cache Components serves the App Shell first for ids
 * not listed in `generateStaticParams`. The page still calls `notFound()`
 * as a second line of defence.
 */
export async function rewriteTappaNonTrovata(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const id = tappaDaPercorso(request.nextUrl.pathname);
  if (id === null || (await tappaVisibile(id))) return null;
  const url = request.nextUrl.clone();
  url.pathname = TAPPA_NON_TROVATA_PATH;
  url.search = "";
  return NextResponse.rewrite(url);
}
