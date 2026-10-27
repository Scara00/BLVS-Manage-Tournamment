import type { Categoria, FaseGirone, FaseTabellone } from "@/lib/db/types";
import type { LivelloGironi } from "@/lib/gironi/fasi/fase";

/** One player of a board, by registration (a registration is one player). */
export type GiocatoreGirone = {
  iscrizioneId: string;
  /** Full name, never truncated in the editor. */
  nome: string;
};

export type GironeEditor = {
  id: string;
  nome: string;
  posizione: number;
  /**
   * Gold/Silver marker of the group: from its own phase (`gironi.fase`,
   * BLVS-39), else the board's `tabelloni.fase` for the initial groups.
   */
  fase: FaseTabellone | null;
  /** `gironi.fase`; absent = an initial group. */
  faseGirone?: FaseGirone;
  giocatori: GiocatoreGirone[];
};

/** The groups of one board, as the editor shows and changes them. */
export type ComposizioneGironi = {
  tabelloneId: string;
  fase: FaseTabellone | null;
  /** `tabelloni.versione_gironi`: grows by 1 on every saved change. */
  versione: number;
  /** A group match has started: the groups can no longer change. */
  bloccata: boolean;
  /**
   * Which groups the editor shows (`livello_modificabile()`): the initial
   * ones, then the gold/silver proposal, then the finals. Absent = initial.
   */
  livello?: LivelloGironi;
  gironi: GironeEditor[];
  /** Confirmed players of the board who are in no group. */
  nonAssegnati: GiocatoreGirone[];
};

/** The «Non assegnati» column, as a destination. */
export const NON_ASSEGNATI = "non-assegnati";
export type Destinazione = string;

export type OperazioneGironi =
  | { tipo: "sposta"; iscrizioneId: string; verso: Destinazione }
  | { tipo: "scambia"; a: string; b: string }
  | { tipo: "aggiungi"; fase?: FaseGirone }
  | { tipo: "elimina"; gironeId: string };

/** The editor of one board of one stage (w-admin-gironi). */
export type EditorGironi = {
  tappa: { id: string; nome: string };
  categoria: Categoria;
  composizione: ComposizioneGironi;
};

export type EsitoGironi =
  | { status: "ok"; composizione: ComposizioneGironi }
  | { status: "conflict"; message: string; composizione: ComposizioneGironi }
  | { status: "bloccata"; message: string; composizione: ComposizioneGironi }
  | { status: "error"; message: string; composizione?: ComposizioneGironi }
  | { status: "sessionExpired"; message: string }
  | { status: "permissionDenied"; message: string };

export type ModificaGironiInput = {
  tappaId: string;
  categoria: Categoria;
  versione: number;
  operazione: OperazioneGironi;
};

export type ModificaGironiAction = (
  input: ModificaGironiInput,
) => Promise<EsitoGironi>;

export const GIRONI_EDITOR_MESSAGES = {
  conflict:
    "Nel frattempo qualcun altro ha cambiato i gironi: ora vedi quelli aggiornati. Ripeti la modifica se serve ancora.",
  bloccata:
    "Le partite dei gironi sono iniziate: i gironi non si possono più modificare.",
  failed: "Modifica non salvata. Riprova tra qualche istante.",
  notFound: "Giocatore o girone non trovato: ricarica la pagina.",
  sessionExpired: "La sessione è scaduta. Accedi di nuovo per continuare.",
  permissionDenied: "Solo un amministratore può modificare i gironi.",
  offline: "Sei offline: la modifica non è stata salvata.",
} as const;

export const CATEGORIA_SEGMENTO: Record<Categoria, string> = { M: "m", F: "f" };

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  M: "maschile",
  F: "femminile",
};

/** Accepts `m`/`f` (any case) from the URL. */
export function parseCategoriaSegmento(segmento: string): Categoria | null {
  const valore = segmento.toUpperCase();
  return valore === "M" || valore === "F" ? valore : null;
}

/** w-admin-gironi of one board. */
export function gironiEditorPath(
  tappaId: string,
  categoria: Categoria,
): string {
  return `/admin/tappe/${encodeURIComponent(tappaId)}/gironi/${CATEGORIA_SEGMENTO[categoria]}`;
}
