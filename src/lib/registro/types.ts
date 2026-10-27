import type { TipoEventoRegistro, ValoreRegistro } from "@/lib/audit";
import type { Categoria } from "@/lib/db/types";

/** The match an entry is about, as `partita_registro()` returns it. */
export type PartitaRegistroDb = {
  categoria: Categoria;
  fase: string;
  girone: string | null;
  turno: number;
  squadra_a: string[];
  squadra_b: string[];
};

/** A row of `public.registro_tappa()`. */
export type VoceRegistroDb = {
  id: number | string;
  tipo: TipoEventoRegistro;
  created_at: string;
  autore: string | null;
  partita_id: string | null;
  partita: PartitaRegistroDb | null;
  valore_prima: ValoreRegistro | null;
  valore_dopo: ValoreRegistro | null;
  nota: string | null;
  /** Entries matching the filters from the cursor on, these included. */
  totale: number | string;
};

/** A row of `public.partite_registro_tappa()`. */
export type PartitaFiltroDb = {
  partita_id: string;
  partita: PartitaRegistroDb | null;
};

/** Exceptions get a filled badge; ordinary entries are plain text. */
export type TipoVoceView = {
  tipo: TipoEventoRegistro;
  label: string;
  badge: boolean;
};

export type VoceRegistroView = {
  id: number;
  tipo: TipoVoceView;
  /** ISO instant. */
  quando: string;
  /** Rome day, «YYYY-MM-DD», for grouping. */
  giorno: string;
  /** «10:15», Europe/Rome. */
  ora: string;
  /** «27/10/2026, 10:15:03», Europe/Rome. */
  dataOra: string;
  autore: string;
  partita: { id: string; etichetta: string } | null;
  prima: string;
  dopo: string;
  nota: string | null;
};

export type GiornoRegistro = {
  giorno: string;
  /** «Oggi · sabato 12 giugno», «Ieri · venerdì 11 giugno», «giovedì 10 giugno». */
  etichetta: string;
  voci: VoceRegistroView[];
};

export type FiltriRegistro = {
  tipo: TipoEventoRegistro | null;
  partita: string | null;
};

export type PartitaFiltro = { id: string; etichetta: string };

/** One page of the log, newest first. */
export type PaginaRegistro = {
  voci: VoceRegistroView[];
  /** Older entries not loaded yet. */
  restanti: number;
};

export type RegistroTappaView = {
  tappa: { id: string; nome: string };
  /** Rome day of the read, «YYYY-MM-DD»: the «Oggi» group. */
  oggi: string;
  filtri: FiltriRegistro;
  partite: PartitaFiltro[];
  pagina: PaginaRegistro;
  /** «HH:mm» of the read, shown when offline. */
  lettoAlle: string;
};

export type CaricaPrecedentiEsito =
  | { status: "ok"; pagina: PaginaRegistro }
  | { status: "sessionExpired" | "error"; message: string };

export type CaricaPrecedentiAction = (
  tappaId: string,
  filtri: FiltriRegistro,
  primaDi: number,
) => Promise<CaricaPrecedentiEsito>;
