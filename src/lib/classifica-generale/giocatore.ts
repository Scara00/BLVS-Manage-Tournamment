/**
 * w-giocatore (BLVS-50): one player of the overall standing, stage by
 * stage. Pure: the card is a view on the same live row as w-classifica.
 */
import type { Categoria } from "@/lib/db/types";
import type {
  LiveEvent,
  OverallPlayerRow,
  OverallStageResult,
  OverallStandings,
} from "@/lib/live/types";
import { puntiLabel, puntiProvvisoriLabel } from "./annuncio";

/**
 * The name of a deleted account (R-79): the only thing shown, never a
 * personal datum. Mirrors `public.nome_anonimo()` (migration
 * 20261027460000), which stores it as nome «Giocatore», cognome «anonimo».
 */
export const NOME_ANONIMO = "Giocatore anonimo";

export type FaseTappaTesto = {
  /** «★» / «◆», always next to the word; null outside the finals. */
  simbolo: "★" | "◆" | null;
  testo: string;
};

/** The phase of one stage, as text (never colour or symbol alone). */
export function faseTappaTesto(
  fase: OverallStageResult["phase"],
): FaseTappaTesto {
  if (fase === "gold") return { simbolo: "★", testo: "Finale gold" };
  if (fase === "silver") return { simbolo: "◆", testo: "Finale silver" };
  return { simbolo: null, testo: "Non in finale" };
}

/** The player's row of a standing, or undefined. */
export function rigaGiocatore(
  standings: OverallStandings | undefined,
  utenteId: string,
): OverallPlayerRow | undefined {
  return standings?.rows.find((r) => r.playerId === utenteId);
}

/** Stages played, newest first. */
export function tappeGiocatore(
  row: OverallPlayerRow,
): readonly OverallStageResult[] {
  return [...(row.results ?? [])].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || a.stageId.localeCompare(b.stageId),
  );
}

/** The name shown for a row: never a personal name for a deleted account. */
export function nomeGiocatore(
  row: Pick<OverallPlayerRow, "name" | "anonymous">,
) {
  return row.anonymous ? NOME_ANONIMO : row.name;
}

/** «2ª», «2ª a pari merito». */
export function posizioneLabel(position: number, tied = false): string {
  return `${position}ª${tied ? " a pari merito" : ""}`;
}

/** Page title and h1 of w-giocatore. */
export function titoloScheda(row: OverallPlayerRow | undefined): string {
  return row ? nomeGiocatore(row) : "Scheda del giocatore";
}

/**
 * The one sentence w-giocatore says per update: this player's place and
 * points, never the whole standing.
 */
export function annuncioScheda(event: LiveEvent, utenteId: string): string {
  if (event.type !== "overall-standings" || !event.standings) {
    return "Scheda del giocatore aggiornata";
  }
  const row = rigaGiocatore(event.standings, utenteId);
  const parti = ["Scheda aggiornata"];
  if (event.standings.change) parti.push(event.standings.change);
  if (row) {
    parti.push(
      `${nomeGiocatore(row)} ${posizioneLabel(row.position, row.tied)}, ${row.provisional ? puntiProvvisoriLabel(row.points) : puntiLabel(row.points)}`,
    );
  }
  return parti.join(": ");
}

/** «Maschile» / «Femminile», for the card's summary. */
export function categoriaLabel(categoria: Categoria): string {
  return categoria === "M" ? "Maschile" : "Femminile";
}

const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

/** `2026-05-16` → «16 maggio 2026» (no time zone: it is a calendar day). */
export function dataTappaLabel(data: string): string {
  const [anno, mese, giorno] = data.split("-").map(Number);
  if (!anno || !mese || !giorno) return data;
  return `${giorno} ${MESI[mese - 1]} ${anno}`;
}
