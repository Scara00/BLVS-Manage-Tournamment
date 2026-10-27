import "server-only";
import { connection } from "next/server";
import { isUuid } from "@/lib/api/validation";
import { getCurrentUser } from "@/lib/auth/session";
import type { Categoria, FaseGirone, FaseTabellone } from "@/lib/db/types";
import { getDemoTappaGestione } from "@/lib/demo/gestione-tappe";
import { coloreGirone, livelloGirone } from "@/lib/gironi/fasi/fase";
import { classificaDemo, getDemoPunteggi } from "@/lib/demo/punteggi";
import {
  nomiGiocatori,
  toGroupStandings,
  toLiveMatch,
} from "@/lib/punteggi/format";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { now } from "@/lib/time/server-time";
import { getLiveBus } from "./bus";
import { soloTappa, type FasiTabelloni, type LiveMe } from "./tappa";
import type { GroupStandings, LiveMatch, LiveSync } from "./types";

export type LiveTappa =
  | { status: "notFound" }
  | { status: "sessionExpired"; tappa: { id: string; nome: string } }
  | {
      status: "ok";
      tappa: { id: string; nome: string };
      sync: LiveSync;
      me: LiveMe;
      fasi: FasiTabelloni;
    };

type UnoOMolti<T> = T | T[] | null;

function primo<T>(valore: UnoOMolti<T>): T | null {
  return Array.isArray(valore) ? (valore[0] ?? null) : valore;
}

type IscrizioneLive = {
  id: string;
  tabelloni: UnoOMolti<{ categoria: Categoria }>;
  girone_iscrizioni: { gironi: UnoOMolti<{ fase: FaseGirone }> }[] | null;
};

const ORDINE_LIVELLO = ["iniziale", "gold_silver", "finali"] as const;

/** Gold/Silver of the player's most advanced group, or null. */
export function coloreDellIscrizione(
  iscrizione: IscrizioneLive,
): FaseTabellone | null {
  const fasi = (iscrizione.girone_iscrizioni ?? [])
    .map((gi) => primo(gi.gironi)?.fase)
    .filter((f): f is FaseGirone => f !== undefined)
    .sort(
      (a, b) =>
        ORDINE_LIVELLO.indexOf(livelloGirone(b)) -
        ORDINE_LIVELLO.indexOf(livelloGirone(a)),
    );
  return fasi.length > 0 ? coloreGirone(fasi[0]) : null;
}

/**
 * Demo boards (no Supabase env): the men's board plays Gold, the women's
 * Silver, so the demo shows both marks.
 */
const DEMO_FASI: FasiTabelloni = { M: "gold", F: "silver" };

/**
 * In the demo the player is the first registration of the men's board
 * (seat 1, Girone A), as on the other demo player pages.
 */
function demoMe(tappaId: string, matches: readonly LiveMatch[]): LiveMe {
  const id = `${tappaId}-M-i1`;
  const plays = matches.some((m) =>
    [...(m.players?.home ?? []), ...(m.players?.away ?? [])].some(
      (p) => p.id === id,
    ),
  );
  return plays ? id : null;
}

/** The demo stage's matches and standings, as BLVS-32 publishes them. */
function demoBase(tappaId: string): {
  matches: LiveMatch[];
  groups: GroupStandings[];
} {
  const elenco = getDemoPunteggi(tappaId);
  if (!elenco) return { matches: [], groups: [] };
  const matches = elenco.partite.map((p) => toLiveMatch(p, tappaId));
  const gironi = new Map(elenco.partite.map((p) => [p.gironeId, p]));
  const groups: GroupStandings[] = [];
  for (const [gironeId, p] of gironi) {
    const classifica = classificaDemo(tappaId, gironeId);
    if (!classifica) continue;
    groups.push(
      toGroupStandings(
        { id: gironeId, nome: p.gironeNome },
        classifica,
        nomiGiocatori(elenco.partite.filter((x) => x.gironeId === gironeId)),
        { stageId: tappaId, category: p.categoria },
      ),
    );
  }
  return { matches, groups };
}

function merge<T extends { id: string }>(
  base: readonly T[],
  newer: readonly T[],
): T[] {
  const byId = new Map(base.map((x) => [x.id, x]));
  for (const x of newer) byId.set(x.id, x);
  return [...byId.values()];
}

/**
 * The live state of one stage: what the bus has published for it, on top
 * of the demo scores when Supabase is not configured. With Supabase the
 * bus is the only source until a DB feed exists (BLVS-32 publishes every
 * save).
 */
export async function readLiveTappaSync(tappaId: string): Promise<LiveSync> {
  await connection();
  const bus = getLiveBus().snapshot();
  const published = soloTappa(bus, tappaId);
  const base = readSupabaseEnv()
    ? { matches: [], groups: [] }
    : demoBase(tappaId);
  return {
    snapshot: {
      ...bus,
      matches: merge(base.matches, published.matches),
      groups: merge(base.groups, published.groups),
      overall: [],
      pendingScores: [],
      phases: [],
    },
    syncedAt: now().toISOString(),
  };
}

/** w-live of a stage for the signed-in player (BLVS-36). */
export async function readLiveTappa(tappaId: string): Promise<LiveTappa> {
  await connection();
  if (!readSupabaseEnv()) {
    const tappa = getDemoTappaGestione(tappaId);
    if (!tappa || tappa.row.stato === "bozza") return { status: "notFound" };
    const sync = await readLiveTappaSync(tappaId);
    return {
      status: "ok",
      tappa: { id: tappa.row.id, nome: tappa.row.nome },
      sync,
      me: demoMe(tappaId, sync.snapshot.matches),
      fasi: DEMO_FASI,
    };
  }

  if (!isUuid(tappaId)) return { status: "notFound" };
  const supabase = await createClient();
  const [{ data: tappa, error }, { data: tabelloni }] = await Promise.all([
    supabase
      .from("tappe")
      .select("id, nome")
      .eq("id", tappaId)
      .neq("stato", "bozza")
      .maybeSingle<{ id: string; nome: string }>(),
    supabase
      .from("tabelloni")
      .select("categoria, fase")
      .eq("tappa_id", tappaId)
      .returns<{ categoria: Categoria; fase: FaseTabellone | null }[]>(),
  ]);
  if (error) throw new Error(`tappa: ${error.message}`);
  if (!tappa) return { status: "notFound" };

  const user = await getCurrentUser();
  if (!user) return { status: "sessionExpired", tappa };
  const { data: iscrizione } = await user.supabase
    .from("iscrizioni")
    .select("id, tabelloni (categoria), girone_iscrizioni (gironi (fase))")
    .eq("tappa_id", tappaId)
    .eq("utente_id", user.id)
    .in("stato", ["confermata", "in_attesa"])
    .maybeSingle<IscrizioneLive>();

  const fasi: FasiTabelloni = {};
  for (const t of tabelloni ?? []) if (t.fase) fasi[t.categoria] = t.fase;
  // Gold/Silver of the player's own board comes from their latest group
  // (BLVS-39); the board's `tabelloni.fase` is only the fallback.
  const colore = iscrizione ? coloreDellIscrizione(iscrizione) : null;
  const categoria = primo(iscrizione?.tabelloni ?? null)?.categoria;
  if (colore && categoria) fasi[categoria] = colore;
  return {
    status: "ok",
    tappa,
    sync: await readLiveTappaSync(tappaId),
    me: iscrizione?.id ?? null,
    fasi,
  };
}
