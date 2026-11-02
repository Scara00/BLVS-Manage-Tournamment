import "server-only";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  classificaTappaDaDati,
  DATI_VUOTI,
  type DatiClassificaGenerale,
} from "@/lib/classifica-generale/dati";
import type { CategoriaTabellone, FormatoTappa } from "@/lib/db/types";
import {
  classificaTappaDemo,
  getDemoTabelloneLive,
} from "@/lib/demo/admin-live";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { getLiveBus } from "@/lib/live/bus";
import type { LiveSync, StageStandings } from "@/lib/live/types";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time/server-time";
import type { ClassificaTappa } from "./classifica";
import { leggiClassificaTappa } from "./dati";
import {
  idClassificaTappa,
  parseCategoriaTappa,
  toStageStandings,
} from "./live";

/**
 * The stage standing of one category, recomputed on every call, so a
 * corrected score or a withdrawal shows at once. Null when the stage has
 * no such board. Without Supabase env (CI, e2e) it reads w-admin-live's
 * demo finals (BLVS-43).
 */
export async function readClassificaTappa(
  tappaId: string,
  categoria: CategoriaTabellone,
): Promise<ClassificaTappa | null> {
  if (!readSupabaseEnv()) return classificaTappaDemo(tappaId, categoria);
  return leggiClassificaTappa(await createClient(), tappaId, categoria);
}

const VUOTA: ClassificaTappa = {
  righe: [],
  stato: "in_attesa",
  puntiProvvisori: true,
};

type TappaLetta = {
  id: string;
  nome: string;
  stagione: number | null;
  formato: FormatoTappa;
};

/** A non-draft stage, or null (drafts and missing stages look the same). */
async function leggiTappa(tappaId: string): Promise<TappaLetta | null> {
  if (!readSupabaseEnv()) {
    const tappa = getDemoTappaGestione(tappaId);
    if (!tappa || tappa.row.stato === "bozza") return null;
    return {
      id: tappa.row.id,
      nome: tappa.row.nome,
      stagione: null,
      formato: "classico",
    };
  }
  if (!isUuid(tappaId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tappe")
    .select("id, nome, stagione, formato")
    .eq("id", tappaId)
    .neq("stato", "bozza")
    .maybeSingle<TappaLetta>();
  if (error) throw new Error(`tappa: ${error.message}`);
  return data;
}

/**
 * The stage standing as a player may read it: names come from the public
 * security-definer RPC `classifica_generale_dati` (BLVS-44), filtered to
 * this stage, because RLS hides other players' names (BLVS-40 gotcha).
 * A stage that does not count yet (not started) has an empty standing.
 */
async function classificaPerGiocatore(
  tappa: TappaLetta,
  categoria: CategoriaTabellone,
): Promise<ClassificaTappa> {
  if (!readSupabaseEnv()) {
    return classificaTappaDemo(tappa.id, categoria) ?? VUOTA;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("classifica_generale_dati", {
    p_categoria: categoria,
    p_stagione: tappa.stagione,
  });
  if (error) throw new Error(`classifica di tappa: ${error.message}`);
  const dati = (data as DatiClassificaGenerale | null) ?? DATI_VUOTI;
  if (!dati.tappe.some((t) => t.id === tappa.id)) return VUOTA;
  const { classifica } = classificaTappaDaDati(dati, tappa.id);
  // The mixed board gives no points to the overall standing.
  return categoria === "X"
    ? {
        ...classifica,
        senzaPunti: true,
        righe: classifica.righe.map((r) => ({ ...r, punti: null })),
      }
    : classifica;
}

const ULTIME_KEY = Symbol.for("blvs.classificaTappa.ultime");

/** The last standing computed per board on this server (read or publish). */
function ultime(): Map<string, StageStandings> {
  const g = globalThis as unknown as Record<
    symbol,
    Map<string, StageStandings> | undefined
  >;
  return (g[ULTIME_KEY] ??= new Map());
}

/**
 * The standing last computed for a board on this server, e.g. by a page
 * read: what open pages show when nothing was published yet.
 */
export function ultimaClassificaTappa(id: string): StageStandings | undefined {
  return ultime().get(id);
}

/** One board's stage standing in its live shape, recomputed now. */
export async function calcolaStageStandings(
  tappaId: string,
  categoria: CategoriaTabellone,
): Promise<StageStandings | null> {
  const tappa = await leggiTappa(tappaId);
  if (!tappa) return null;
  const standings = toStageStandings(
    await classificaPerGiocatore(tappa, categoria),
    { tappaId: tappa.id, categoria, nome: tappa.nome },
  );
  ultime().set(standings.id, standings);
  return standings;
}

/** The live state of w-classifica-tappa: the bus plus one fresh standing. */
export async function readClassificaTappaSync(
  tappaId: string,
  categoria: CategoriaTabellone,
): Promise<LiveSync> {
  await connection();
  const standings = await calcolaStageStandings(tappaId, categoria);
  const bus = getLiveBus().snapshot();
  return {
    snapshot: {
      ...bus,
      matches: [],
      groups: [],
      overall: [],
      overallStandings: [],
      pendingScores: [],
      phases: [],
      boards: [],
      closed: (bus.closed ?? []).filter(
        (c) => c.id === idClassificaTappa(tappaId, categoria),
      ),
      stageStandings: standings ? [standings] : [],
    },
    syncedAt: now().toISOString(),
  };
}

export type VistaClassificaTappa =
  | { status: "notFound" }
  | {
      status: "ok";
      tappa: { id: string; nome: string };
      categoria: CategoriaTabellone;
      /** Registration id of the signed-in player in this stage, or null. */
      me: string | null;
      /** The board the player is registered on, or null. */
      meCategoria: CategoriaTabellone | null;
      standingsId: string;
      sync: LiveSync;
    };

type IscrizionePropria = {
  id: string;
  tabelloni:
    | { categoria: CategoriaTabellone }
    | { categoria: CategoriaTabellone }[]
    | null;
};

/** The signed-in player's registration in the stage and their category. */
async function chiSono(tappaId: string): Promise<{
  me: string | null;
  meCategoria: CategoriaTabellone | null;
  utente: CategoriaTabellone | null;
}> {
  if (!readSupabaseEnv()) {
    // In the demo the player is the men's seat 1, as on w-live.
    const iscritto = getDemoTabelloneLive(tappaId, "M", now()) !== null;
    return iscritto
      ? { me: `${tappaId}-M-i1`, meCategoria: "M", utente: "M" }
      : { me: null, meCategoria: null, utente: "M" };
  }
  const user = await getCurrentUser();
  if (!user) return { me: null, meCategoria: null, utente: null };
  const [{ data: iscrizione }, { data: utente }] = await Promise.all([
    user.supabase
      .from("iscrizioni")
      .select("id, tabelloni (categoria)")
      .eq("tappa_id", tappaId)
      .eq("utente_id", user.id)
      .in("stato", ["confermata", "ritirata", "in_attesa"])
      .maybeSingle<IscrizionePropria>(),
    user.supabase
      .from("utenti")
      .select("categoria")
      .eq("id", user.id)
      .maybeSingle<{ categoria: CategoriaTabellone | null }>(),
  ]);
  const tabellone = Array.isArray(iscrizione?.tabelloni)
    ? iscrizione.tabelloni[0]
    : iscrizione?.tabelloni;
  return {
    me: iscrizione?.id ?? null,
    meCategoria: tabellone?.categoria ?? null,
    utente: utente?.categoria ?? null,
  };
}

/**
 * w-classifica-tappa (BLVS-49) for the signed-in player: the category
 * defaults to their own board, then their profile's, then «M».
 */
export async function readVistaClassificaTappa(
  tappaId: string,
  categoriaRichiesta: unknown,
): Promise<VistaClassificaTappa> {
  await connection();
  const tappa = await leggiTappa(tappaId);
  if (!tappa) return { status: "notFound" };
  const chi = await chiSono(tappa.id);
  // A mixed stage has one board, whatever was asked.
  const categoria =
    tappa.formato === "misto"
      ? "X"
      : (parseCategoriaTappa(categoriaRichiesta) ??
        chi.meCategoria ??
        chi.utente ??
        "M");
  return {
    status: "ok",
    tappa: { id: tappa.id, nome: tappa.nome },
    categoria,
    me: chi.me,
    meCategoria: chi.meCategoria,
    standingsId: idClassificaTappa(tappa.id, categoria),
    sync: await readClassificaTappaSync(tappa.id, categoria),
  };
}
