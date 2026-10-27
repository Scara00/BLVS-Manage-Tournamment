import type { StatoTappa } from "@/lib/db/types";

/** Why a change failed; the UI picks the copy and the follow-up from it. */
export type MotivoErrore =
  "invalid" | "conflict" | "permissionDenied" | "sessionExpired" | "network";

export type CambioStatoState =
  | { status: "idle" }
  | { status: "success"; stato: StatoTappa; message: string; at: number }
  | { status: "error"; reason: MotivoErrore; message: string; at: number };

export const initialCambioStatoState: CambioStatoState = { status: "idle" };

export type ScadenzaState =
  | { status: "idle" }
  | { status: "success"; message: string; at: number }
  | {
      status: "error";
      reason: MotivoErrore;
      message: string;
      fields: { chiudonoIl?: string };
      at: number;
    };

export const initialScadenzaState: ScadenzaState = { status: "idle" };

export type CambioStatoAction = (
  prev: CambioStatoState,
  formData: FormData,
) => Promise<CambioStatoState>;

export type ScadenzaAction = (
  prev: ScadenzaState,
  formData: FormData,
) => Promise<ScadenzaState>;

export const GESTIONE_MESSAGES = {
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied:
    "Solo l'amministrazione può cambiare lo stato di una tappa.",
  conflict:
    "La tappa è cambiata nel frattempo: ricarica la pagina per vedere lo stato attuale.",
  transizione: "Questo passaggio di stato non è permesso.",
  network: "Non è stato possibile salvare: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai confermare quando la connessione torna disponibile.",
  scadenzaSalvata: "Scadenza delle iscrizioni aggiornata.",
  scadenzaInvalida: "Controlla la scadenza indicata.",
} as const;

export function gestioneTappaPath(id: string): string {
  return `/admin/tappe/${encodeURIComponent(id)}`;
}
