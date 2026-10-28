import type { MotivoErrore } from "@/lib/tappe/gestione-state";

/** Result of «Salva la stagione» on w-admin-tappa (BLVS-44, Q-06). */
export type StagioneState =
  | { status: "idle" }
  | { status: "success"; stagione: number; message: string; at: number }
  | {
      status: "error";
      reason: MotivoErrore;
      message: string;
      /** Shown under the field. */
      campo?: string;
      at: number;
    };

export const initialStagioneState: StagioneState = { status: "idle" };

export type StagioneAction = (
  prev: StagioneState,
  formData: FormData,
) => Promise<StagioneState>;

export const STAGIONE_MESSAGES = {
  salvata: (s: number) => `Stagione aggiornata: la tappa conta per il ${s}.`,
  invalida: "Indica un anno di quattro cifre, tra il 2000 e il 2100.",
  archiviata: "Una tappa archiviata non si può più modificare.",
  nonTrovata: "La tappa non esiste più: ricarica la pagina.",
} as const;
