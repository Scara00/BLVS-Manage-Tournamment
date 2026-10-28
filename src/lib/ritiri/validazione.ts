import { RITIRO_MESSAGES } from "./format";
import { TIPI_RITIRO, type ErroriRitiro, type TipoRitiro } from "./types";

export type DatiRitiro = {
  iscrizioneId: string;
  tipo: TipoRitiro;
  /** The chosen matches with the score version the preview showed. */
  partite: { partitaId: string; versione: number }[];
};

/** «<id>:<versione>», one form value per ticked match. */
export function campoPartita(partitaId: string, versione: number) {
  return `${partitaId}:${versione}`;
}

function leggiPartita(valore: string) {
  const i = valore.lastIndexOf(":");
  if (i <= 0) return null;
  const versione = Number(valore.slice(i + 1));
  if (!Number.isInteger(versione) || versione < 0) return null;
  return { partitaId: valore.slice(0, i), versione };
}

/**
 * The form's fields, checked as the server checks them. Every error is
 * shown next to its field.
 */
export function validaRitiro(input: {
  iscrizioneId: unknown;
  tipo: unknown;
  partite: readonly unknown[];
}): { ok: true; dati: DatiRitiro } | { ok: false; errori: ErroriRitiro } {
  const errori: ErroriRitiro = {};
  const iscrizioneId =
    typeof input.iscrizioneId === "string" ? input.iscrizioneId.trim() : "";
  if (!iscrizioneId) errori.giocatore = RITIRO_MESSAGES.giocatoreMancante;
  const tipo = TIPI_RITIRO.find((t) => t === input.tipo);
  if (!tipo) errori.tipo = RITIRO_MESSAGES.tipoMancante;
  const partite = input.partite.flatMap((v) => {
    const p = typeof v === "string" ? leggiPartita(v) : null;
    return p ? [p] : [];
  });
  if (partite.length === 0) errori.partite = RITIRO_MESSAGES.partiteMancanti;
  else if (partite.length !== input.partite.length) {
    errori.partite = RITIRO_MESSAGES.partitaNonValida;
  }
  if (Object.keys(errori).length > 0 || !tipo) return { ok: false, errori };
  return { ok: true, dati: { iscrizioneId, tipo, partite } };
}
