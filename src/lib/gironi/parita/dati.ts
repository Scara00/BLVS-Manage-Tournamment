import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria } from "@/lib/db/types";
import {
  toPartitaGirone,
  type PartitaGironeRow,
} from "@/lib/gironi/classifica";
import type { DatiParitaGirone } from "./format";

/*
 * Reads of w-admin-parita on Supabase, through RLS with the admin's
 * session. The same inputs as BLVS-27's `leggiClassificaGirone` (every
 * registration of the group, every match with its group id), so the
 * `firma` computed here is the one `risolviParitaGirone` checks.
 */

type UnoOMolti<T> = T | T[] | null;

function primo<T>(valore: UnoOMolti<T>): T | null {
  if (Array.isArray(valore)) return valore[0] ?? null;
  return valore;
}

type GironeDb = {
  id: string;
  nome: string;
  posizione: number;
  girone_iscrizioni: {
    iscrizione_id: string;
    iscrizioni: UnoOMolti<{
      utenti: UnoOMolti<{ nome: string; cognome: string }>;
    }>;
  }[];
};

type PartitaDb = PartitaGironeRow & { girone_id: string | null };

type DecisioneDb = {
  girone_id: string;
  firma: string;
  ordine: string[];
  motivo: string;
};

/** «Nome Cognome» of a registration, as the registro writes it. */
function nomeCompleto(riga: GironeDb["girone_iscrizioni"][number]): string {
  const utente = primo(primo(riga.iscrizioni)?.utenti ?? null);
  const nome = `${utente?.nome ?? ""} ${utente?.cognome ?? ""}`.trim();
  return nome || riga.iscrizione_id;
}

/**
 * Players, matches and stored decisions of every group of one board, in
 * group order; null when the stage has no such board.
 */
export async function leggiDatiParitaTabellone(
  supabase: SupabaseClient,
  tappaId: string,
  categoria: Categoria,
): Promise<DatiParitaGirone[] | null> {
  const { data: tabellone, error: tabelloneError } = await supabase
    .from("tabelloni")
    .select("id")
    .eq("tappa_id", tappaId)
    .eq("categoria", categoria)
    .maybeSingle();
  if (tabelloneError) throw new Error(`tabellone: ${tabelloneError.message}`);
  if (!tabellone) return null;

  const { data: gironiData, error: gironiError } = await supabase
    .from("gironi")
    .select(
      "id, nome, posizione, girone_iscrizioni (iscrizione_id, iscrizioni (utenti (nome, cognome)))",
    )
    .eq("tabellone_id", (tabellone as { id: string }).id)
    .order("posizione");
  if (gironiError) throw new Error(`gironi: ${gironiError.message}`);
  const gironi = gironiData as unknown as GironeDb[];
  if (gironi.length === 0) return [];
  const ids = gironi.map((g) => g.id);

  const [partite, decisioni] = await Promise.all([
    supabase
      .from("partite")
      .select(
        "id, stato, girone_id, punteggi(sets), partita_giocatori(iscrizione_id, squadra)",
      )
      .in("girone_id", ids),
    supabase
      .from("spareggi_girone")
      .select("girone_id, firma, ordine, motivo")
      .in("girone_id", ids),
  ]);
  if (partite.error) throw new Error(`partite: ${partite.error.message}`);
  if (decisioni.error) {
    throw new Error(`spareggi: ${decisioni.error.message}`);
  }
  const righePartite = partite.data as unknown as PartitaDb[];
  const righeDecisioni = decisioni.data as DecisioneDb[];

  return gironi.map((g) => ({
    tappaId,
    categoria,
    gironeId: g.id,
    gironeNome: g.nome,
    giocatori: g.girone_iscrizioni
      .map((r) => ({ iscrizioneId: r.iscrizione_id, nome: nomeCompleto(r) }))
      .sort((a, b) => (a.iscrizioneId < b.iscrizioneId ? -1 : 1)),
    partite: righePartite
      .filter((p) => p.girone_id === g.id)
      .map(toPartitaGirone),
    decisioni: righeDecisioni
      .filter((d) => d.girone_id === g.id)
      .map(({ firma, ordine, motivo }) => ({ firma, ordine, motivo })),
  }));
}
