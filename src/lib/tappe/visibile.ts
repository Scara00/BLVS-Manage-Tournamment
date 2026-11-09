import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { demoGroups } from "@/lib/demo/tournament";
import { demoDettaglioTappa } from "@/lib/demo/tappa-dettaglio";
import { haCookieDiSessione } from "@/lib/supabase/auth-cookie";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { inProva, type ConProva } from "./prova";

/**
 * w-tappa, w-iscrizione-ok, w-live, w-tabellone, w-classifica-tappa and
 * w-girone: `/tappe/<id>`, `/tappe/<id>/iscrizione`, `/tappe/<id>/live`,
 * `/tappe/<id>/tabellone`, `/tappe/<id>/classifica` and
 * `/tappe/<id>/gironi/<girone>`.
 */
const PAGINA_TAPPA =
  /^\/tappe\/([^/]+)(?:\/iscrizione|\/live|\/tabellone|\/classifica|\/gironi\/[^/]+)?\/?$/;

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
 * so a draft and a missing stage look the same. Demo data without env,
 * where a «tappa di prova» is visible too (the demo has no roles).
 */
export async function tappaVisibile(id: string): Promise<boolean> {
  const env = readSupabaseEnv();
  if (!env) {
    // The player calendar, or a stage created by the demo fixtures.
    const gestione = getDemoTappaGestione(id)?.row;
    const stato = demoDettaglioTappa(id)?.stato ?? gestione?.stato;
    if (stato === undefined) return false;
    return stato !== "bozza" || inProva({ stato, prova: gestione?.prova });
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
 * True when this session sees the stage as a «tappa di prova»: RLS shows
 * drafts to admins only, so for anyone else it reads nothing.
 */
export async function tappaDiProvaVisibile(
  supabase: SupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("tappe")
    .select("stato, prova")
    .eq("id", id)
    .maybeSingle<ConProva>();
  if (error) {
    console.error("[tappe] verifica della tappa di prova non riuscita", error);
    return false;
  }
  return data !== null && inProva(data);
}

/** The real HTTP 404 of a stage page: a rewrite to an unmatched path. */
function tappaNonTrovata(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = TAPPA_NON_TROVATA_PATH;
  url.search = "";
  return NextResponse.rewrite(url, { request });
}

/** What the proxy does with a stage page (see `controllaTappa`). */
export type ControlloTappa =
  | { esito: "prosegui" }
  | { esito: "nonTrovata"; risposta: NextResponse }
  | {
      esito: "conSessione";
      controllaPagina: (
        supabase: SupabaseClient,
        signedIn: boolean,
      ) => Promise<NextResponse | null>;
    };

/**
 * Proxy step: a page of a draft or of a stage that does not exist is
 * rewritten to an unmatched path, so it answers a real HTTP 404 (w-404)
 * before any rendering. In the page itself the status would already be
 * committed to 200: Cache Components serves the App Shell first for ids
 * not listed in `generateStaticParams`. The page still calls `notFound()`
 * as a second line of defence.
 *
 * A request with a session may be an admin opening a «tappa di prova»:
 * that check needs the refreshed session, so it runs in `updateSession`
 * (`conSessione`), which answers the same 404 to anyone else.
 */
export async function controllaTappa(
  request: NextRequest,
): Promise<ControlloTappa> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return { esito: "prosegui" };
  }
  const id = tappaDaPercorso(request.nextUrl.pathname);
  if (id === null || (await tappaVisibile(id))) return { esito: "prosegui" };
  if (!readSupabaseEnv() || !isUuid(id) || !haCookieDiSessione(request)) {
    return { esito: "nonTrovata", risposta: tappaNonTrovata(request) };
  }
  return {
    esito: "conSessione",
    controllaPagina: async (supabase, signedIn) =>
      signedIn && (await tappaDiProvaVisibile(supabase, id))
        ? null
        : tappaNonTrovata(request),
  };
}

/** `/gironi/<id>`: the demo group page (CI, e2e). */
const PAGINA_GIRONE_DEMO = /^\/gironi\/([^/]+)\/?$/;

/**
 * Proxy step for `/gironi/<id>`: only the demo groups exist there, and only
 * without Supabase env (real groups are `/tappe/<id>/gironi/<girone>`).
 * Any other id is rewritten to the unmatched path, so it is a real HTTP 404
 * before the page streams its shell with a 200, like `controllaTappa`.
 */
export function rewriteGironeDemoNonTrovato(
  request: NextRequest,
): NextResponse | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const match = PAGINA_GIRONE_DEMO.exec(request.nextUrl.pathname);
  if (!match) return null;
  let id = match[1];
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the raw segment: it matches no group anyway.
  }
  if (!readSupabaseEnv() && demoGroups.some((g) => g.id === id)) return null;
  const url = request.nextUrl.clone();
  url.pathname = TAPPA_NON_TROVATA_PATH;
  url.search = "";
  return NextResponse.rewrite(url);
}
