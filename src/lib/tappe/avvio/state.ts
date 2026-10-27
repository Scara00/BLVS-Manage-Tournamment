import type { Categoria } from "@/lib/db/types";
import type { ProblemaAvvio } from "./regole";

/** Result of `avviaFase`; expected failures are values, never throws. */
export type AvvioFaseState =
  | { status: "idle" }
  | { status: "success"; partite: number; message: string; at: number }
  /** The server refused the start: one entry per error, each with a link. */
  | {
      status: "fieldErrors";
      errori: ProblemaAvvio[];
      message: string;
      at: number;
    }
  | {
      status: "error";
      reason: "conflict" | "sessionExpired" | "permissionDenied" | "network";
      message: string;
      at: number;
    };

export const initialAvvioFaseState: AvvioFaseState = { status: "idle" };

export type AvvioFaseAction = (
  prev: AvvioFaseState,
  formData: FormData,
) => Promise<AvvioFaseState>;

export const AVVIO_MESSAGES = {
  bloccato: "La fase non è partita: correggi i gironi indicati e riprova.",
  giaAvviata:
    "La fase di questo tabellone è già stata avviata: ricarica la pagina per vedere le partite.",
  nonAvviabile:
    "La tappa non è più a iscrizioni chiuse: ricarica la pagina per vedere lo stato attuale.",
  partiteIniziate:
    "Alcune partite dei gironi sono già iniziate: la fase non si può avviare di nuovo.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può avviare una fase.",
  network:
    "Non è stato possibile avviare la fase: controlla la connessione e riprova.",
  offline: "Sei offline: potrai avviare la fase quando la connessione torna.",
} as const;

export function messaggioSuccesso(
  categoria: Categoria,
  partite: number,
): string {
  const tabellone = categoria === "M" ? "maschile" : "femminile";
  const n = partite === 1 ? "1 partita creata" : `${partite} partite create`;
  return `Gironi iniziali avviati per il tabellone ${tabellone}: ${n}.`;
}
