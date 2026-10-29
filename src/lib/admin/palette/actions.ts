"use server";

import { readAdminTappe } from "@/lib/admin/tappe-read";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import type { Categoria } from "@/lib/db/types";
import { cercaDemoGiocatori } from "@/lib/demo/iscritti-admin";
import { getDemoPunteggi } from "@/lib/demo/punteggi";
import { filtriRicerca, paroleRicerca } from "@/lib/iscrizioni/admin/search";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { CATEGORIA_TABELLONE } from "@/lib/tappe/gestione-format";
import { toRisultatoPartita, type PartitaTrovataRow } from "./partite";
import {
  corrisponde,
  cercaTappe,
  PALETTE_MAX_PER_GRUPPO,
  schedaGiocatoreHref,
} from "./ricerca";
import type { EsitoPalette, RisultatoPalette } from "./types";

const MESSAGGI = {
  sessionExpired: "Sessione scaduta: accedi di nuovo per cercare.",
  network: "Ricerca non riuscita. Riprova tra qualche secondo.",
} as const;

type GiocatoreRow = {
  id: string;
  nome: string;
  cognome: string;
  email: string | null;
  categoria: Categoria | null;
};

function toRisultatoGiocatore(g: GiocatoreRow): RisultatoPalette {
  const categoria = g.categoria
    ? CATEGORIA_TABELLONE[g.categoria]
    : "Categoria non scelta";
  return {
    tipo: "giocatore",
    id: g.id,
    titolo: `${g.cognome} ${g.nome}`.trim(),
    dettaglio: [g.email, categoria].filter(Boolean).join(" · "),
    href: schedaGiocatoreHref(g.id, g.categoria),
  };
}

/** Demo matches (no Supabase env): the group matches of every demo stage. */
function partiteDemo(
  tappe: readonly { id: string; nome: string }[],
  parole: readonly string[],
): PartitaTrovataRow[] {
  const trovate: PartitaTrovataRow[] = [];
  for (const tappa of tappe) {
    for (const p of getDemoPunteggi(tappa.id)?.partite ?? []) {
      const nomi = [...p.squadre.a, ...p.squadre.b].map(
        (g) => `${g.nome} ${g.cognome}`,
      );
      if (!corrisponde(parole, [tappa.nome, p.gironeNome, ...nomi])) continue;
      trovate.push({
        partita_id: p.id,
        tappa_id: tappa.id,
        tappa_nome: tappa.nome,
        categoria: p.categoria,
        fase: "gironi",
        girone_nome: p.gironeNome,
        turno: p.turno,
        stato: p.stato,
        sets: p.sets,
        squadra_a: p.squadre.a,
        squadra_b: p.squadre.b,
      });
      if (trovate.length >= PALETTE_MAX_PER_GRUPPO) return trovate;
    }
  }
  return trovate;
}

/**
 * w-admin-palette: stages, players and matches holding every word of
 * `query` (at most `PALETTE_MAX_PER_GRUPPO` each). The admin role is
 * checked here, and again by RLS and the RPC. Without Supabase env (CI,
 * e2e) it searches the demo stores.
 */
export async function cercaPalette(query: string): Promise<EsitoPalette> {
  const parole = paroleRicerca(String(query).slice(0, 100));
  if (parole.length === 0) {
    return { status: "ok", tappe: [], giocatori: [], partite: [] };
  }

  if (!readSupabaseEnv()) {
    const tappe = await readAdminTappe();
    return {
      status: "ok",
      tappe: cercaTappe(tappe, parole),
      giocatori: cercaDemoGiocatori("", parole, PALETTE_MAX_PER_GRUPPO).map(
        toRisultatoGiocatore,
      ),
      partite: partiteDemo(tappe, parole).map(toRisultatoPartita),
    };
  }

  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("[palette] verifica della sessione non riuscita", error);
    user = null;
  }
  if (!user || user.ruolo !== "admin") {
    return {
      status: "error",
      reason: "sessionExpired",
      message: MESSAGGI.sessionExpired,
    };
  }

  try {
    let ricercaGiocatori = user.supabase
      .from("utenti")
      .select("id, nome, cognome, email, categoria")
      .eq("ruolo", "giocatore");
    for (const filtro of filtriRicerca(parole)) {
      ricercaGiocatori = ricercaGiocatori.or(filtro);
    }
    const [tappe, giocatori, partite] = await Promise.all([
      readAdminTappe(),
      ricercaGiocatori
        .order("cognome")
        .order("nome")
        .limit(PALETTE_MAX_PER_GRUPPO),
      user.supabase.rpc("cerca_partite_admin", {
        p_parole: parole,
        p_limite: PALETTE_MAX_PER_GRUPPO,
      }),
    ]);
    if (giocatori.error) throw giocatori.error;
    if (partite.error) throw partite.error;
    return {
      status: "ok",
      tappe: cercaTappe(tappe, parole),
      giocatori: (giocatori.data as GiocatoreRow[]).map(toRisultatoGiocatore),
      partite: (partite.data as PartitaTrovataRow[]).map(toRisultatoPartita),
    };
  } catch (error) {
    console.error("[palette] ricerca non riuscita", error);
    return { status: "error", reason: "network", message: MESSAGGI.network };
  }
}
