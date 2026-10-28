import "server-only";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import {
  DEMO_ME_CLASSIFICA,
  esisteStagioneDemo,
  getDemoDatiClassifica,
  getDemoStagioni,
} from "@/lib/demo/classifica-generale";
import { getLiveBus } from "@/lib/live/bus";
import type { LiveSync, OverallStandings } from "@/lib/live/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { getServerTimeParts, now } from "@/lib/time/server-time";
import {
  classificaDaDati,
  idClassifica,
  leggiClassificaGenerale,
  leggiStagioni,
  toOverallStandings,
} from "./dati";
import { parseStagione, stagioneScelta } from "./stagione";

export type VistaClassificaGenerale = {
  categoria: Categoria;
  stagione: number;
  /** Seasons offered in the filter, newest first. */
  stagioni: readonly number[];
  /** `utenti.id` of the signed-in player, or null. */
  me: string | null;
  sync: LiveSync;
};

export function parseCategoria(valore: unknown): Categoria | null {
  return CATEGORIE.includes(valore as Categoria) ? (valore as Categoria) : null;
}

/** The standing of one category and season, recomputed now. */
export async function calcolaClassificaGenerale(
  categoria: Categoria,
  stagione: number | null,
  change: string | null = null,
): Promise<OverallStandings> {
  if (!readSupabaseEnv()) {
    return toOverallStandings(
      classificaDaDati(
        getDemoDatiClassifica(categoria, stagione),
        categoria,
        stagione,
      ),
      change,
    );
  }
  return toOverallStandings(
    await leggiClassificaGenerale(await createClient(), categoria, stagione),
    change,
  );
}

async function stagioni(richiesta: number | null): Promise<number[]> {
  if (!readSupabaseEnv()) {
    const elenco = getDemoStagioni();
    // A hidden e2e season is shown only when asked for by URL.
    if (richiesta !== null && esisteStagioneDemo(richiesta)) {
      return [...new Set([richiesta, ...elenco])].sort((a, b) => b - a);
    }
    return elenco;
  }
  return leggiStagioni(await createClient());
}

async function meECategoria(): Promise<{
  me: string | null;
  categoria: Categoria | null;
}> {
  if (!readSupabaseEnv()) return { me: DEMO_ME_CLASSIFICA, categoria: "M" };
  const user = await getCurrentUser();
  if (!user) return { me: null, categoria: null };
  const { data } = await user.supabase
    .from("utenti")
    .select("categoria")
    .eq("id", user.id)
    .maybeSingle<{ categoria: Categoria | null }>();
  return { me: user.id, categoria: data?.categoria ?? null };
}

/** The live state of w-classifica: the bus plus one fresh standing. */
export async function readClassificaGeneraleSync(
  categoria: Categoria,
  stagione: number | null,
): Promise<LiveSync> {
  await connection();
  const standings = await calcolaClassificaGenerale(categoria, stagione);
  const bus = getLiveBus().snapshot();
  return {
    snapshot: {
      ...bus,
      matches: [],
      groups: [],
      pendingScores: [],
      phases: [],
      boards: [],
      overallStandings: [standings],
    },
    syncedAt: now().toISOString(),
  };
}

/** Parses `<M|F>:<season>` (the snapshot route's `?classifica=`). */
export function parseIdClassifica(
  id: string,
): { categoria: Categoria; stagione: number | null } | null {
  const [cat, stag] = id.split(":");
  const categoria = parseCategoria(cat);
  if (!categoria) return null;
  if (stag === "tutte") return { categoria, stagione: null };
  const stagione = parseStagione(stag);
  return stagione === null ? null : { categoria, stagione };
}

/**
 * w-classifica for the current visitor (signed in or not): the category
 * defaults to the player's own, the season to the newest one.
 */
export async function readClassificaGenerale(params: {
  categoria?: unknown;
  stagione?: unknown;
}): Promise<VistaClassificaGenerale> {
  await connection();
  const richiesta = parseStagione(params.stagione);
  const [elenco, chi] = await Promise.all([
    stagioni(richiesta),
    meECategoria(),
  ]);
  const categoria = parseCategoria(params.categoria) ?? chi.categoria ?? "M";
  const stagione = stagioneScelta(richiesta, elenco, getServerTimeParts().year);
  return {
    categoria,
    stagione,
    stagioni: elenco.includes(stagione) ? elenco : [stagione, ...elenco],
    me: chi.me,
    sync: await readClassificaGeneraleSync(categoria, stagione),
  };
}

export { idClassifica };
