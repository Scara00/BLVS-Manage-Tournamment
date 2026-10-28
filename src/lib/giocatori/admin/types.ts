import type {
  Categoria,
  Ruolo,
  StatoIscrizione,
  StatoTappa,
} from "@/lib/db/types";

/** One row of w-admin-giocatori. */
export type GiocatoreAdmin = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | null;
  ruolo: Ruolo;
  /** `categoria_verificata_il` unset: the list's «da verificare» filter. */
  daVerificare: boolean;
};

export type ElencoGiocatori = {
  giocatori: GiocatoreAdmin[];
  /** Rows matching the filters, every page. */
  totale: number;
  pagina: number;
  pagine: number;
};

/** One registration on w-admin-giocatore. */
export type IscrizioneGiocatore = {
  id: string;
  tappaId: string;
  tappa: string;
  /** `YYYY-MM-DD`. */
  data: string;
  statoTappa: StatoTappa;
  stato: StatoIscrizione;
  /** The board it is on: a played stage stays on it after a change. */
  categoria: Categoria;
  posto: number | null;
};

/** Points of one season in the player's overall standing. */
export type PuntiStagione = {
  stagione: number;
  categoria: Categoria;
  posizione: number | null;
  punti: number;
  tappe: number;
  provvisori: boolean;
};

/** One registration that moves to the other board (RPC `effetti_cambio_categoria`). */
export type IscrizioneSpostata = {
  iscrizioneId: string;
  tappaId: string;
  tappa: string;
  data: string;
  statoTappa: StatoTappa;
  postoPrima: number | null;
  postoDopo: number;
  posti: number;
  /** Active registrations on the target board before the move. */
  occupati: number;
  /** The target board is full: the admin goes past the maximum. */
  oltreMassimo: boolean;
  /** It leaves groups already proposed on the old board. */
  inGirone: boolean;
};

/** A stage in progress that blocks the change. */
export type TappaBloccante = { tappaId: string; tappa: string; data: string };

/** One season's points leaving `da` for `a` (BLVS-54 «punti spostati»). */
export type SpostamentoStagione = {
  stagione: number;
  punti: number;
  tappe: number;
  provvisori: boolean;
  /** Place in the old category's standing before the change. */
  posizionePrima: number | null;
  /** Place in the new category's standing after the change. */
  posizioneDopo: number | null;
};

export type EffettiCambio = {
  da: Categoria | null;
  a: Categoria;
  iscrizioni: IscrizioneSpostata[];
  bloccanti: TappaBloccante[];
  punti: SpostamentoStagione[];
};

/** What the confirmation sends back as `attesi`. */
export type EffettoAtteso = { iscrizione_id: string; posto_dopo: number };

export type SchedaGiocatoreAdmin = {
  giocatore: GiocatoreAdmin;
  iscrizioni: IscrizioneGiocatore[];
  punti: PuntiStagione[];
  /** One proposed change per category the player is not in. */
  cambi: EffettiCambio[];
};

export type CambioCategoriaState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason: ErroreCambio;
      message: string;
      at: number;
    };

export type ErroreCambio =
  | "sessionExpired"
  | "permissionDenied"
  | "invalid"
  | "giocatoreNonTrovato"
  | "stessaCategoria"
  | "tappaInCorso"
  | "effettiCambiati"
  | "network";

export const CAMBIO_CATEGORIA_INITIAL: CambioCategoriaState = {
  status: "idle",
};

export type CambioCategoriaAction = (
  prev: CambioCategoriaState,
  formData: FormData,
) => Promise<CambioCategoriaState>;
