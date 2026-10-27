import type {
  ImpattoFase,
  SceltaImpatto,
} from "@/lib/punteggi/correzione/types";

/** «Ritiro»: the player leaves; «Assenza»: they miss some matches. */
export const TIPI_RITIRO = ["ritiro", "assenza"] as const;
export type TipoRitiro = (typeof TIPI_RITIRO)[number];

export const TIPO_RITIRO_LABEL: Record<TipoRitiro, string> = {
  ritiro: "Ritiro",
  assenza: "Assenza",
};

/** A row of `assenze_partita`: the player's absence from one match. */
export type AssenzaRegistrata = {
  partitaId: string;
  iscrizioneId: string;
  tipo: TipoRitiro;
};

export type CampoRitiro = "giocatore" | "tipo" | "partite";

export type ErroriRitiro = Partial<Record<CampoRitiro, string>>;

export type MotivoErroreRitiro =
  | "conflict"
  | "nonRegistrabile"
  | "permissionDenied"
  | "sessionExpired"
  | "network";

/**
 * The outcome of `registraRitiro`. `at` grows on every answer, so the same
 * outcome twice still moves focus.
 */
export type RitiroState =
  | { status: "idle" }
  | { status: "fieldErrors"; errori: ErroriRitiro; at: number }
  /** BLVS-41's w-admin-impatto-fase: the next phase already exists. */
  | {
      status: "impatto";
      impatto: ImpattoFase;
      /** «Rigenera» refused without the tick. */
      erroreConferma: string | null;
      /** The next phase changed since the dialog opened. */
      avviso: string | null;
      at: number;
    }
  | { status: "error"; reason: MotivoErroreRitiro; message: string; at: number }
  | {
      status: "success";
      message: string;
      scelta: SceltaImpatto | null;
      punteggiPersi: number;
      at: number;
    };

export const initialRitiroState: RitiroState = { status: "idle" };

export type RitiroAction = (
  prev: RitiroState,
  formData: FormData,
) => Promise<RitiroState>;
