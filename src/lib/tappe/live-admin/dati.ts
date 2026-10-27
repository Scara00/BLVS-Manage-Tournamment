import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Categoria,
  FaseGioco,
  FaseGirone,
  FasePartita,
  SetPunteggio,
  StatoPartita,
  StatoTappa,
} from "@/lib/db/types";
import { vincitore } from "./format";
import type { OperazionePartita } from "./state";
import type { GiocatorePartita, PartitaLive, TabelloneLive } from "./types";

/*
 * Reads and writes of w-admin-live on Supabase, through RLS with the
 * admin's session (policies `partite_admin`, `punteggi_admin`). The
 * in-memory demo store (`src/lib/demo/admin-live.ts`) mirrors every rule.
 */

type UnoOMolti<T> = T | T[] | null;

function primo<T>(valore: UnoOMolti<T>): T | null {
  if (Array.isArray(valore)) return valore[0] ?? null;
  return valore;
}

type PartitaDb = {
  id: string;
  fase: FasePartita;
  turno: number;
  campo: string | null;
  programmata_il: string | null;
  stato: StatoPartita;
  girone_id: string | null;
  gironi: UnoOMolti<{ nome: string; posizione: number; fase?: FaseGirone }>;
  punteggi: UnoOMolti<{ sets: SetPunteggio[]; versione: number }>;
  partita_giocatori: {
    squadra: "A" | "B";
    iscrizione_id: string;
    iscrizioni: UnoOMolti<{
      posto: number | null;
      utenti: UnoOMolti<{ nome: string; cognome: string }>;
    }>;
  }[];
};

const COLONNE_PARTITA = `id, fase, turno, campo, programmata_il, stato, girone_id,
  gironi (nome, posizione, fase),
  punteggi (sets, versione),
  partita_giocatori (squadra, iscrizione_id, iscrizioni (posto, utenti (nome, cognome)))`;

function toPartita(row: PartitaDb): PartitaLive {
  const girone = primo(row.gironi);
  const punteggio = primo(row.punteggi);
  const squadra = (s: "A" | "B"): GiocatorePartita[] =>
    row.partita_giocatori
      .filter((g) => g.squadra === s)
      .map((g) => {
        const iscrizione = primo(g.iscrizioni);
        const utente = primo(iscrizione?.utenti ?? null);
        return {
          iscrizioneId: g.iscrizione_id,
          nome: utente?.nome ?? "",
          cognome: utente?.cognome ?? "",
          posto: iscrizione?.posto ?? 0,
        };
      })
      .sort((a, b) => a.posto - b.posto || a.cognome.localeCompare(b.cognome))
      .map(({ iscrizioneId, nome, cognome }) => ({
        iscrizioneId,
        nome,
        cognome,
      }));
  return {
    id: row.id,
    fase: row.fase,
    gironeId: row.girone_id,
    gironeNome: girone?.nome ?? null,
    gironeFase: girone?.fase,
    gironePosizione: girone?.posizione ?? 0,
    turno: row.turno,
    campo: row.campo,
    programmataIl: row.programmata_il,
    stato: row.stato,
    squadraA: squadra("A"),
    squadraB: squadra("B"),
    sets: punteggio?.sets ?? [],
    versione: punteggio?.versione ?? 1,
  };
}

/** One board with all its matches, or null for an unknown stage. */
export async function leggiTabelloneLive(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
  adesso: Date,
): Promise<TabelloneLive | null> {
  const { data: tappa, error: tappaError } = await supabase
    .from("tappe")
    .select(
      "id, nome, stato, tabelloni (id, categoria, fase_gioco, concluso_il)",
    )
    .eq("id", tappaId)
    .maybeSingle();
  if (tappaError) throw new Error(`tappa: ${tappaError.message}`);
  if (!tappa) return null;
  const row = tappa as unknown as {
    id: string;
    nome: string;
    stato: StatoTappa;
    tabelloni: {
      id: string;
      categoria: Categoria;
      fase_gioco: FaseGioco | null;
      concluso_il: string | null;
    }[];
  };
  const board = row.tabelloni.find((t) => t.categoria === categoria);
  if (!board) return null;

  const { data, error } = await supabase
    .from("partite")
    .select(COLONNE_PARTITA)
    .eq("tabellone_id", board.id);
  if (error) throw new Error(`partite: ${error.message}`);

  return {
    tappa: { id: row.id, nome: row.nome, stato: row.stato },
    categoria,
    tabelloneId: board.id,
    faseGioco: board.fase_gioco,
    conclusoIl: board.concluso_il,
    partite: (data as unknown as PartitaDb[]).map(toPartita),
    lettoIl: adesso.toISOString(),
  };
}

/** Where a match lives: for the live event after a write. */
export async function leggiDovePartita(
  supabase: SupabaseClient,
  partitaId: string,
): Promise<{ tappaId: string; categoria: Categoria } | null> {
  const { data, error } = await supabase
    .from("partite")
    .select("tabelloni (tappa_id, categoria)")
    .eq("id", partitaId)
    .maybeSingle();
  if (error) throw new Error(`partita: ${error.message}`);
  const tabellone = primo(
    (
      data as {
        tabelloni: UnoOMolti<{ tappa_id: string; categoria: Categoria }>;
      } | null
    )?.tabelloni ?? null,
  );
  return tabellone
    ? { tappaId: tabellone.tappa_id, categoria: tabellone.categoria }
    : null;
}

/** Outcome of a write; the action turns it into a message. */
export type EsitoModifica =
  | { ok: true; partita: PartitaLive }
  | {
      ok: false;
      motivo:
        | "conflict"
        | "nonTrovata"
        | "senzaVincitore"
        | "tappaChiusa"
        | "tabelloneConcluso";
    };

type PgError = { code?: string; hint?: string | null; message?: string };

function esitoErrore(error: PgError): EsitoModifica {
  if (error.hint === "tappa_archiviata" || error.hint === "tappa_annullata") {
    return { ok: false, motivo: "tappaChiusa" };
  }
  // BLVS-43: the guard on a concluded board's scores.
  if (error.hint === "conferma_tabellone_concluso") {
    return { ok: false, motivo: "tabelloneConcluso" };
  }
  throw new Error(error.message ?? "scrittura non riuscita");
}

async function leggiPartita(
  supabase: SupabaseClient,
  partitaId: string,
): Promise<PartitaLive | null> {
  const { data, error } = await supabase
    .from("partite")
    .select(COLONNE_PARTITA)
    .eq("id", partitaId)
    .maybeSingle();
  if (error) throw new Error(`partita: ${error.message}`);
  return data ? toPartita(data as unknown as PartitaDb) : null;
}

/**
 * «Inizia» (da giocare → in corso) or «Concludi» (in corso → conclusa,
 * only with a winning score). The update is conditional on the state the
 * admin saw, so 0 rows means someone else got there first.
 */
export async function cambiaStatoDb(
  supabase: SupabaseClient,
  partitaId: string,
  operazione: OperazionePartita,
): Promise<EsitoModifica> {
  const partita = await leggiPartita(supabase, partitaId);
  if (!partita) return { ok: false, motivo: "nonTrovata" };
  const [da, a]: [StatoPartita, StatoPartita] =
    operazione === "inizia"
      ? ["programmata", "in_corso"]
      : ["in_corso", "conclusa"];
  if (partita.stato !== da) return { ok: false, motivo: "conflict" };
  if (operazione === "concludi" && !vincitore(partita.sets)) {
    return { ok: false, motivo: "senzaVincitore" };
  }

  const { data, error } = await supabase
    .from("partite")
    .update({ stato: a })
    .eq("id", partitaId)
    .eq("stato", da)
    .select("id");
  if (error) return esitoErrore(error);
  if (!data || data.length === 0) return { ok: false, motivo: "conflict" };
  return { ok: true, partita: { ...partita, stato: a } };
}

/**
 * Saves the sets read at `versione` (409-style conflict otherwise) and,
 * with `concludi`, closes the match. A concluded match keeps a winner.
 */
export async function salvaPunteggioDb(
  supabase: SupabaseClient,
  utenteId: string,
  partitaId: string,
  versione: number,
  sets: SetPunteggio[],
  concludi: boolean,
): Promise<EsitoModifica> {
  const partita = await leggiPartita(supabase, partitaId);
  if (!partita) return { ok: false, motivo: "nonTrovata" };
  if (partita.versione !== versione) return { ok: false, motivo: "conflict" };
  const chiude = concludi || partita.stato === "conclusa";
  if (chiude && !vincitore(sets))
    return { ok: false, motivo: "senzaVincitore" };
  if (concludi && partita.stato !== "in_corso") {
    return { ok: false, motivo: "conflict" };
  }

  const { data, error } = await supabase
    .from("punteggi")
    .update({ sets, versione: versione + 1, aggiornato_da: utenteId })
    .eq("partita_id", partitaId)
    .eq("versione", versione)
    .select("versione");
  if (error) return esitoErrore(error);
  if (!data || data.length === 0) return { ok: false, motivo: "conflict" };

  let stato = partita.stato;
  if (concludi) {
    const fine = await supabase
      .from("partite")
      .update({ stato: "conclusa" })
      .eq("id", partitaId)
      .eq("stato", "in_corso")
      .select("id");
    if (fine.error) return esitoErrore(fine.error);
    if (!fine.data || fine.data.length === 0) {
      return { ok: false, motivo: "conflict" };
    }
    stato = "conclusa";
  }
  return {
    ok: true,
    partita: { ...partita, sets, versione: versione + 1, stato },
  };
}
