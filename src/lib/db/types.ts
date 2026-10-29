/**
 * Row types and enums of the schema in `supabase/migrations/`. Kept by hand:
 * change them together with the SQL.
 */

export const RUOLI = ["admin", "giocatore"] as const;
export type Ruolo = (typeof RUOLI)[number];

export const CATEGORIE = ["M", "F"] as const;
export type Categoria = (typeof CATEGORIE)[number];

export const STATI_TAPPA = [
  "bozza",
  "iscrizioni_aperte",
  "iscrizioni_chiuse",
  "in_corso",
  "conclusa",
  "annullata",
  "archiviata",
] as const;
export type StatoTappa = (typeof STATI_TAPPA)[number];

export const STATI_ISCRIZIONE = [
  "in_attesa",
  "confermata",
  "rifiutata",
  "ritirata",
] as const;
export type StatoIscrizione = (typeof STATI_ISCRIZIONE)[number];

export const STATI_PARTITA = [
  "programmata",
  "in_corso",
  "conclusa",
  "annullata",
] as const;
export type StatoPartita = (typeof STATI_PARTITA)[number];

export const FASI_TABELLONE = ["gold", "silver"] as const;
export type FaseTabellone = (typeof FASI_TABELLONE)[number];

/**
 * Game phase of a board, in order: started by the admin (BLVS-29), then
 * the gold/silver groups and the finals (BLVS-39). Mirror of the CHECK
 * `tabelloni_fase_gioco`.
 */
export const FASI_GIOCO = [
  "gironi_iniziali",
  "gironi_gold_silver",
  "finali",
] as const;
export type FaseGioco = (typeof FASI_GIOCO)[number];

/**
 * Phase of one group (`gironi.fase`, BLVS-39): the initial groups, the
 * gold and silver groups, and the two final groups.
 */
export const FASI_GIRONE = [
  "iniziale",
  "gold",
  "silver",
  "finale_gold",
  "finale_silver",
] as const;
export type FaseGirone = (typeof FASI_GIRONE)[number];

export const FASI_PARTITA = ["gironi", "eliminazione", "finale"] as const;
export type FasePartita = (typeof FASI_PARTITA)[number];

export type Utente = {
  id: string;
  email: string;
  ruolo: Ruolo;
  categoria: Categoria | null;
  nome: string;
  cognome: string;
  /** Always null: a deleted account is removed, not anonymised any more. */
  anonimizzato_il: null;
  created_at: string;
  updated_at: string;
};

export type Tappa = {
  id: string;
  nome: string;
  luogo: string;
  data_inizio: string;
  data_fine: string;
  stato: StatoTappa;
  iscrizioni_aprono_il: string | null;
  iscrizioni_chiudono_il: string | null;
  /** When registrations closed (set by the DB on the change of state). */
  iscrizioni_chiuse_il: string | null;
  /** True when `chiudi_iscrizioni_scadute()` closed them at the deadline. */
  chiusura_automatica: boolean;
  /** Grows by 1 on every update (trigger `tappe_versione`). */
  versione: number;
  /** Season of the overall standing (BLVS-44); defaults to the year of `data_inizio`. */
  stagione: number;
  /** Meeting point shown to registered players (BLVS-24). */
  ritrovo: string | null;
  ritrovo_alle: string | null;
  /** Free-text programme set by the admin. */
  programma: string | null;
  /** Players may cancel until then; null = the registration deadline. */
  annullabile_fino_al: string | null;
  /** Why the stage was cancelled; set only when cancelling it (BLVS-22). */
  motivo_annullamento: string | null;
  /** When it was cancelled / archived; written by the DB trigger only. */
  annullata_il: string | null;
  archiviata_il: string | null;
  created_at: string;
  updated_at: string;
};

export type Tabellone = {
  id: string;
  tappa_id: string;
  categoria: Categoria;
  /** Seats on this board (one category of the stage); maximum registrations, never below the active ones. */
  posti: number;
  /** Gold/Silver phase, set by the admin; null until then. */
  fase: FaseTabellone | null;
  /** When the board was concluded (BLVS-43); null while still open. */
  concluso_il: string | null;
  /** Started game phase (BLVS-29, `avvia_fase`); null until it starts. */
  fase_gioco: FaseGioco | null;
  fase_avviata_il: string | null;
  /** Version of its groups: +1 on every change saved by the editor (BLVS-28). */
  versione_gironi: number;
};

export type Iscrizione = {
  id: string;
  tappa_id: string;
  tabellone_id: string;
  utente_id: string;
  stato: StatoIscrizione;
  /** Seat number on the board, assigned by the database. */
  posto: number | null;
  created_at: string;
  updated_at: string;
};

export type SetPunteggio = { a: number; b: number };

export type Punteggio = {
  partita_id: string;
  sets: SetPunteggio[];
  versione: number;
  aggiornato_da: string | null;
  updated_at: string;
};

/**
 * One score saved from the device queue (BLVS-33): the key generated on the
 * device, so a repeated send never saves twice.
 */
export type PunteggioInvio = {
  chiave: string;
  partita_id: string;
  /** Score version after the save made with this key. */
  versione: number;
  autore_id: string | null;
  created_at: string;
};

/** Admin's order for a perfect tie in a group (BLVS-27). */
export type SpareggioGirone = {
  id: string;
  girone_id: string;
  /** Fingerprint of the tie (`firmaParita`); the order applies only while it matches. */
  firma: string;
  /** Tied registration ids, best first. */
  ordine: string[];
  motivo: string;
  deciso_da: string | null;
  deciso_il: string;
};

export type VoceRegistro = {
  id: number;
  attore_id: string | null;
  azione: string;
  entita: string;
  entita_id: string | null;
  dati: unknown;
  created_at: string;
};

export type Consenso = {
  id: number;
  utente_id: string;
  tipo: "privacy" | "regolamento" | "immagini" | "marketing";
  /** `PRIVACY_POLICY_VERSION.number` accepted. */
  versione_informativa: string;
  /** `PRIVACY_POLICY_VERSION.date` (YYYY-MM-DD); null on rows before BLVS-12. */
  data_informativa: string | null;
  concesso: boolean;
  /** When the consent was given. */
  created_at: string;
};
