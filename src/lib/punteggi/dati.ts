/**
 * Reads the group matches of a stage through a Supabase client (RLS and
 * the admin check of `partite_punteggio_tappa` apply). Shared by the pages
 * and the server actions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Categoria,
  SetPunteggio,
  StatoPartita,
  StatoTappa,
} from "@/lib/db/types";
import type {
  ElencoPunteggi,
  GiocatorePartita,
  PartitaPunteggio,
} from "./types";

type GiocatoreRow = { iscrizione_id: string; nome: string; cognome: string };

export type PartitaPunteggioRow = {
  partita_id: string;
  categoria: Categoria;
  girone_id: string;
  girone_nome: string;
  turno: number;
  campo: string | null;
  stato: StatoPartita;
  sets: SetPunteggio[];
  versione: number;
  squadra_a: GiocatoreRow[];
  squadra_b: GiocatoreRow[];
};

function giocatore(row: GiocatoreRow): GiocatorePartita {
  return {
    iscrizioneId: row.iscrizione_id,
    nome: row.nome,
    cognome: row.cognome,
  };
}

export function toPartitaPunteggio(row: PartitaPunteggioRow): PartitaPunteggio {
  return {
    id: row.partita_id,
    categoria: row.categoria,
    gironeId: row.girone_id,
    gironeNome: row.girone_nome,
    turno: row.turno,
    campo: row.campo,
    stato: row.stato,
    sets: row.sets ?? [],
    versione: row.versione,
    squadre: {
      a: (row.squadra_a ?? []).map(giocatore),
      b: (row.squadra_b ?? []).map(giocatore),
    },
  };
}

/** The stage and its group matches (one when `partitaId` is given). */
export async function leggiPunteggi(
  supabase: SupabaseClient,
  tappaId: string,
  partitaId?: string,
): Promise<ElencoPunteggi | null> {
  const [tappa, partite] = await Promise.all([
    supabase
      .from("tappe")
      .select("id, nome, stato")
      .eq("id", tappaId)
      .maybeSingle(),
    supabase.rpc("partite_punteggio_tappa", {
      p_tappa: tappaId,
      p_partita: partitaId ?? null,
    }),
  ]);
  if (tappa.error) throw new Error(`tappa: ${tappa.error.message}`);
  if (partite.error) throw partite.error;
  if (!tappa.data) return null;
  const row = tappa.data as { id: string; nome: string; stato: StatoTappa };
  return {
    tappa: { id: row.id, nome: row.nome, stato: row.stato },
    partite: (partite.data as PartitaPunteggioRow[]).map(toPartitaPunteggio),
  };
}
