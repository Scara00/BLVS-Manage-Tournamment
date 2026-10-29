import type { DemoEsitoIscritti } from "@/lib/demo/iscritti-admin";
import { ISCRITTI_MESSAGES } from "./messages";
import type { MotivoErroreIscritti } from "./types";

type DbError = { code?: string; hint?: string | null; message?: string };

export type ErroreIscritti = { reason: MotivoErroreIscritti; message: string };

const PER_HINT: Record<string, string> = {
  gia_iscritto: ISCRITTI_MESSAGES.giaIscritto,
  posti_esauriti: ISCRITTI_MESSAGES.postiEsauriti,
  categoria_mancante: ISCRITTI_MESSAGES.categoriaMancante,
  giocatore_non_trovato: ISCRITTI_MESSAGES.giocatoreNonTrovato,
  iscrizione_non_trovata: ISCRITTI_MESSAGES.iscrizioneNonTrovata,
  tappa_non_iscrivibile: ISCRITTI_MESSAGES.nonModificabile,
  tappa_annullata: ISCRITTI_MESSAGES.annullata,
  tappa_archiviata: ISCRITTI_MESSAGES.archiviata,
};

/**
 * Maps an error of `admin_iscrivi_giocatore()`, `admin_rimuovi_iscrizione()`
 * and `admin_conferma_iscrizioni()` (their hints) onto the copy shown.
 */
export function erroreDaDb(error: DbError): ErroreIscritti {
  const known = error.hint ? PER_HINT[error.hint] : undefined;
  if (known) return { reason: "invalid", message: known };
  switch (error.code) {
    case "23505":
      return { reason: "invalid", message: ISCRITTI_MESSAGES.giaIscritto };
    case "P0002":
      return { reason: "invalid", message: ISCRITTI_MESSAGES.tappaNonTrovata };
    case "42501":
      return {
        reason: "permissionDenied",
        message: ISCRITTI_MESSAGES.permissionDenied,
      };
    default:
      console.error("[iscritti] modifica non riuscita", error);
      return { reason: "network", message: ISCRITTI_MESSAGES.network };
  }
}

const PER_MOTIVO_DEMO: Record<
  Extract<DemoEsitoIscritti, { ok: false }>["motivo"],
  string
> = {
  tappaNonTrovata: ISCRITTI_MESSAGES.tappaNonTrovata,
  giocatoreNonTrovato: ISCRITTI_MESSAGES.giocatoreNonTrovato,
  iscrizioneNonTrovata: ISCRITTI_MESSAGES.iscrizioneNonTrovata,
  categoriaMancante: ISCRITTI_MESSAGES.categoriaMancante,
  giaIscritto: ISCRITTI_MESSAGES.giaIscritto,
  postiEsauriti: ISCRITTI_MESSAGES.postiEsauriti,
  annullata: ISCRITTI_MESSAGES.annullata,
  archiviata: ISCRITTI_MESSAGES.archiviata,
  nonModificabile: ISCRITTI_MESSAGES.nonModificabile,
};

export function erroreDaDemo(
  esito: Extract<DemoEsitoIscritti, { ok: false }>,
): ErroreIscritti {
  return { reason: "invalid", message: PER_MOTIVO_DEMO[esito.motivo] };
}
