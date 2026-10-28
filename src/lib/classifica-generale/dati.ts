/**
 * Builds the overall standing from the rows of the public RPC
 * `classifica_generale_dati` (BLVS-44). Each stage standing is recomputed
 * with BLVS-40's `classificaTappa`, then the points are summed per player.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import type {
  DecisioneSpareggio,
  PartitaGironeRow,
} from "@/lib/gironi/classifica";
import type { OverallStandings } from "@/lib/live/types";
import { classificaTappa, toFinaliTappa } from "@/lib/tappe/classifica";
import { sommaClassifica } from "./somma";
import {
  ordinaClassifica,
  REGOLA_GENERALE,
  type RegolaGenerale,
} from "./spareggi";
import type { ClassificaGenerale, PartecipazioneTappa } from "./types";

/** The jsonb returned by `classifica_generale_dati(categoria, stagione)`. */
export type DatiClassificaGenerale = {
  tappe: readonly {
    id: string;
    nome: string;
    data_inizio: string;
    stagione: number;
    concluso: boolean;
  }[];
  gironi: readonly { id: string; tappa_id: string; fase: string | null }[];
  membri: readonly { girone_id: string; iscrizione_id: string }[];
  partite: readonly (PartitaGironeRow & { girone_id: string | null })[];
  decisioni: readonly (DecisioneSpareggio & { girone_id: string })[];
  iscrizioni: readonly {
    id: string;
    tappa_id: string;
    utente_id: string;
    nome: string;
    cognome: string;
    stato: StatoIscrizione;
  }[];
};

export const DATI_VUOTI: DatiClassificaGenerale = {
  tappe: [],
  gironi: [],
  membri: [],
  partite: [],
  decisioni: [],
  iscrizioni: [],
};

function nomeCompleto(i: { nome: string; cognome: string }, id: string) {
  return `${i.nome} ${i.cognome}`.trim() || id;
}

/** Every player's result in every stage of `dati`. */
export function partecipazioni(
  dati: DatiClassificaGenerale,
): PartecipazioneTappa[] {
  return dati.tappe.flatMap((tappa) => {
    const gironi = dati.gironi.filter((g) => g.tappa_id === tappa.id);
    const idGironi = new Set(gironi.map((g) => g.id));
    const iscrizioni = dati.iscrizioni.filter((i) => i.tappa_id === tappa.id);
    const finali = toFinaliTappa({
      gironi,
      membri: dati.membri.filter((m) => idGironi.has(m.girone_id)),
      partite: dati.partite.filter(
        (p) => p.girone_id !== null && idGironi.has(p.girone_id),
      ),
      iscrizioni: iscrizioni.map((i) => ({
        id: i.id,
        stato: i.stato,
        utente: { nome: i.nome, cognome: i.cognome },
      })),
      decisioni: dati.decisioni.filter((d) => idGironi.has(d.girone_id)),
    });
    const classifica = classificaTappa({ finali, concluso: tappa.concluso });
    const righe = new Map(classifica.righe.map((r) => [r.iscrizioneId, r]));
    return iscrizioni.map((i) => {
      const riga = righe.get(i.id);
      return {
        utenteId: i.utente_id,
        nome: nomeCompleto(i, i.utente_id),
        risultato: {
          tappaId: tappa.id,
          nome: tappa.nome,
          data: tappa.data_inizio,
          posizione: riga?.posizione ?? null,
          punti: riga?.punti ?? 0,
          provvisori: !tappa.concluso,
        },
      };
    });
  });
}

/** The overall standing of `categoria` from the RPC rows. */
export function classificaDaDati(
  dati: DatiClassificaGenerale,
  categoria: Categoria,
  stagione: number | null,
  regola: RegolaGenerale = REGOLA_GENERALE,
): ClassificaGenerale {
  return {
    categoria,
    stagione,
    righe: ordinaClassifica(sommaClassifica(partecipazioni(dati)), regola),
  };
}

/** `<M|F>:<season>` or `<M|F>:tutte`: the live id of one standing. */
export function idClassifica(
  categoria: Categoria,
  stagione: number | null,
): string {
  return `${categoria}:${stagione ?? "tutte"}`;
}

/** The live shape of a standing (w-classifica renders it). */
export function toOverallStandings(
  classifica: ClassificaGenerale,
  change: string | null = null,
): OverallStandings {
  return {
    id: idClassifica(classifica.categoria, classifica.stagione),
    category: classifica.categoria,
    season: classifica.stagione,
    change,
    rows: classifica.righe.map((r) => ({
      playerId: r.utenteId,
      name: r.nome,
      position: r.posizione,
      points: r.punti,
      stages: r.tappeGiocate,
      provisional: r.puntiProvvisori,
      tied: r.pariMerito,
    })),
  };
}

/** Reads and builds a standing through any Supabase client (anon too). */
export async function leggiClassificaGenerale(
  supabase: SupabaseClient,
  categoria: Categoria,
  stagione: number | null,
): Promise<ClassificaGenerale> {
  const { data, error } = await supabase.rpc("classifica_generale_dati", {
    p_categoria: categoria,
    p_stagione: stagione,
  });
  if (error) throw new Error(`classifica generale: ${error.message}`);
  return classificaDaDati(
    (data as DatiClassificaGenerale | null) ?? DATI_VUOTI,
    categoria,
    stagione,
  );
}

/** Seasons with at least one stage that counts, newest first. */
export async function leggiStagioni(
  supabase: SupabaseClient,
): Promise<number[]> {
  const { data, error } = await supabase.rpc("stagioni_classifica");
  if (error) throw new Error(`stagioni: ${error.message}`);
  return ((data as (number | { stagioni_classifica: number })[] | null) ?? [])
    .map((r) => (typeof r === "number" ? r : r.stagioni_classifica))
    .sort((a, b) => b - a);
}
