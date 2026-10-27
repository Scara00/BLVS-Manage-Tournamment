import { REGOLA_GIRONI } from "@/lib/tappe/gironi";
import { posizioneGiocatore } from "./operazioni";
import {
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type Destinazione,
  type GiocatoreGirone,
  type OperazioneGironi,
} from "./types";

/**
 * Shortcuts of «Sposta nel girone…» (w-admin-sposta): digits pick the
 * destination, letters the player to swap with. They never overlap, so
 * both lists can be on screen together.
 */
export const TASTO_NON_ASSEGNATI = "0";
export const TASTO_NESSUNO_SCAMBIO = "X";

export type OpzioneDestinazione = {
  valore: Destinazione;
  nome: string;
  /** «1»…«9» by group order, «0» for «Non assegnati»; null past 9. */
  tasto: string | null;
  giocatori: GiocatoreGirone[];
  /** At least `dimensione` players: moving in would make it too big. */
  pieno: boolean;
};

export type OpzioneScambio = {
  /** An `iscrizioneId`, or null for «no swap, just move». */
  valore: string | null;
  nome: string;
  tasto: string;
};

/** Where the player can go: every other group, then «Non assegnati». */
export function destinazioniSposta(
  composizione: ComposizioneGironi,
  iscrizioneId: string,
  dimensione: number = REGOLA_GIRONI.dimensione,
): OpzioneDestinazione[] {
  const da = posizioneGiocatore(composizione, iscrizioneId);
  const gironi: OpzioneDestinazione[] = composizione.gironi.map((g, i) => ({
    valore: g.id,
    nome: g.nome,
    tasto: i < 9 ? String(i + 1) : null,
    giocatori: g.giocatori,
    pieno: g.giocatori.length >= dimensione,
  }));
  const nonAssegnati: OpzioneDestinazione = {
    valore: NON_ASSEGNATI,
    nome: "Non assegnati",
    tasto: TASTO_NON_ASSEGNATI,
    giocatori: composizione.nonAssegnati,
    pieno: false,
  };
  return [...gironi, nonAssegnati].filter((o) => o.valore !== da);
}

/** «Nessuno» first (X), then the destination's players as A, B, C… */
export function opzioniScambio(
  destinazione: OpzioneDestinazione,
): OpzioneScambio[] {
  if (destinazione.valore === NON_ASSEGNATI) return [];
  return [
    {
      valore: null,
      nome: "Nessuno: sposta soltanto",
      tasto: TASTO_NESSUNO_SCAMBIO,
    },
    ...destinazione.giocatori.slice(0, 23).map((g, i) => ({
      valore: g.iscrizioneId,
      nome: g.nome,
      tasto: String.fromCharCode(65 + i),
    })),
  ];
}

/** Into a full group the default is a swap with its first player. */
export function scambioPredefinito(
  destinazione: OpzioneDestinazione,
): string | null {
  return destinazione.pieno && destinazione.valore !== NON_ASSEGNATI
    ? (destinazione.giocatori[0]?.iscrizioneId ?? null)
    : null;
}

export function operazioneSposta(
  iscrizioneId: string,
  verso: Destinazione,
  scambiaCon: string | null,
): OperazioneGironi {
  return scambiaCon
    ? { tipo: "scambia", a: iscrizioneId, b: scambiaCon }
    : { tipo: "sposta", iscrizioneId, verso };
}

/** A key typed in the dialog: which option it picks, if any. */
export function tastoScorciatoia(
  key: string,
  destinazioni: readonly OpzioneDestinazione[],
  scambi: readonly OpzioneScambio[],
):
  | { tipo: "destinazione"; valore: Destinazione }
  | { tipo: "scambio"; valore: string | null }
  | null {
  const tasto = key.length === 1 ? key.toUpperCase() : "";
  if (!tasto) return null;
  const d = destinazioni.find((o) => o.tasto === tasto);
  if (d) return { tipo: "destinazione", valore: d.valore };
  const s = scambi.find((o) => o.tasto === tasto);
  if (s) return { tipo: "scambio", valore: s.valore };
  return null;
}
