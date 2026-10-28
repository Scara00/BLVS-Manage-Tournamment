import type { FaseGirone } from "@/lib/db/types";
import { REGOLA_FINALI, REGOLA_QUALIFICAZIONE } from "@/lib/gironi/fasi/regole";
import { annuncioPartita, mioLato, type LiveMe } from "./tappa";
import type {
  GroupStandingRow,
  GroupStandings,
  LiveEvent,
  LiveMatch,
  LivePlayer,
  LiveSnapshot,
} from "./types";

/*
 * The group page of a stage (w-girone, BLVS-47): the match in progress,
 * the other matches, the full standing and the gold/silver cut line.
 * Pure, so the rules are unit-tested without React.
 */

/** What the page knows about the group from the server. */
export type GironeInfo = {
  id: string;
  nome: string;
  fase: FaseGirone;
  /**
   * Groups of the same phase on the board: a gold group sends its first
   * `REGOLA_FINALI.giocatori / n` players to the final.
   */
  gironiDellaFase: number;
};

export type VistaGirone = {
  standing: GroupStandings | null;
  /** The match being played now, or null. */
  inCorso: LiveMatch | null;
  /** Every other match of the group, by round. */
  altre: LiveMatch[];
};

function byRound(a: LiveMatch, b: LiveMatch): number {
  return (a.round ?? 0) - (b.round ?? 0) || a.id.localeCompare(b.id);
}

/** Everything w-girone shows, from the stage's live data. */
export function vistaGirone(
  data: Pick<LiveSnapshot, "matches" | "groups">,
  gironeId: string,
): VistaGirone {
  const partite = data.matches
    .filter((m) => m.groupId === gironeId)
    .sort(byRound);
  // A King/Queen group plays one match at a time.
  const inCorso = partite.find((m) => m.state === "in_corso") ?? null;
  return {
    standing: data.groups.find((g) => g.id === gironeId) ?? null,
    inCorso,
    altre: partite.filter((m) => m !== inCorso),
  };
}

export type FasciaTaglio = {
  /** «★» or «◆»: always next to the word, never alone. */
  simbolo: "★" | "◆";
  testo: string;
};

/** Where the cut line sits in a standing, and what it says. */
export type LineaDiTaglio = {
  /** The line is drawn after this many rows. */
  dopo: number;
  /** The players above the line go here. */
  sopra: FasciaTaglio;
  /** The players below go here; null = they stop. */
  sotto: FasciaTaglio | null;
  /** Two players level on the places either side of the line. */
  aCavallo: boolean;
};

const GOLD: FasciaTaglio = { simbolo: "★", testo: "Gold" };
const SILVER: FasciaTaglio = { simbolo: "◆", testo: "Silver" };
const FINALE_GOLD: FasciaTaglio = { simbolo: "★", testo: "Finale gold" };
const FINALE_SILVER: FasciaTaglio = { simbolo: "◆", testo: "Finale silver" };

/** `★ Gold`: the label as shown and read. */
export function etichettaFascia(fascia: FasciaTaglio): string {
  return `${fascia.simbolo} ${fascia.testo}`;
}

/**
 * The cut line of a group (R-39): initial groups split gold from silver
 * (`REGOLA_QUALIFICAZIONE`); a gold or silver group marks the places that
 * reach its final (`REGOLA_FINALI`, top 4/n of n groups). Finals have no
 * line. Null when there is nothing to split.
 */
export function lineaDiTaglio(
  girone: Pick<GironeInfo, "fase" | "gironiDellaFase">,
  rows: readonly Pick<GroupStandingRow, "position">[],
): LineaDiTaglio | null {
  let dopo: number;
  let sopra: FasciaTaglio;
  let sotto: FasciaTaglio | null;
  if (girone.fase === "iniziale") {
    if (REGOLA_QUALIFICAZIONE.gold.length === 0) return null;
    dopo = Math.max(...REGOLA_QUALIFICAZIONE.gold);
    sopra = GOLD;
    sotto = REGOLA_QUALIFICAZIONE.silver.length > 0 ? SILVER : null;
  } else if (girone.fase === "gold" || girone.fase === "silver") {
    const n = Math.max(1, girone.gironiDellaFase);
    if (REGOLA_FINALI.giocatori % n !== 0) return null;
    dopo = REGOLA_FINALI.giocatori / n;
    sopra = girone.fase === "gold" ? FINALE_GOLD : FINALE_SILVER;
    sotto = null;
  } else {
    return null;
  }
  if (dopo <= 0 || rows.length <= dopo) return null;
  return {
    dopo,
    sopra,
    sotto,
    aCavallo: rows[dopo - 1].position === rows[dopo].position,
  };
}

/** A standing column: short header, its full name for screen readers. */
export type ColonnaClassifica = {
  key: "played" | "won" | "points" | "against" | "diff";
  abbr: string;
  nome: string;
};

/** The numeric columns of the standing, in order (R-36). */
export const COLONNE_CLASSIFICA: readonly ColonnaClassifica[] = [
  { key: "played", abbr: "PG", nome: "Partite giocate" },
  { key: "won", abbr: "V", nome: "Vittorie" },
  { key: "points", abbr: "PF", nome: "Punti fatti" },
  { key: "against", abbr: "PS", nome: "Punti subiti" },
  { key: "diff", abbr: "Diff", nome: "Differenza punti" },
];

/** «+5», «−3» (minus sign), «0»; «–» when unknown. */
export function diffLabel(diff: number | undefined): string {
  if (diff === undefined) return "–";
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `−${Math.abs(diff)}`;
  return "0";
}

/** The value shown in a column («–» when an older publisher left it out). */
export function valoreColonna(
  row: GroupStandingRow,
  key: ColonnaClassifica["key"],
): string {
  if (key === "diff") return diffLabel(row.diff);
  const value = row[key];
  return value === undefined ? "–" : String(value);
}

function squadra(players: readonly LivePlayer[] | undefined, fallback: string) {
  return players && players.length > 0
    ? players.map((p) => p.name).join(" e ")
    : fallback;
}

/**
 * ONE short sentence per result (R-62): the player's own match from their
 * side, as w-live says it; any other match by names and score. Standings
 * are never read: the rows reorder silently.
 */
export function annuncioGirone(event: LiveEvent, me: LiveMe): string {
  if (event.type !== "score") return annuncioPartita(event, me);
  if (mioLato(event.match, me)) return annuncioPartita(event, me);
  const { match } = event;
  const teams = `${squadra(match.players?.home, match.home)} contro ${squadra(
    match.players?.away,
    match.away,
  )}`;
  const { partial } = match;
  if ((match.state ?? "in_corso") === "in_corso" && partial) {
    return `${teams}, parziale ${partial.home}-${partial.away}`;
  }
  const last = match.sets.at(-1);
  return last
    ? `${teams}: ${last[0]}-${last[1]}`
    : `${teams}: punteggio azzerato`;
}

/** Events of this group (and its stage) that w-girone takes. */
export function eventoDelGirone(
  event: LiveEvent,
  stageId: string,
  gironeId: string,
): boolean {
  if (event.type === "score") {
    return event.match.stageId === stageId && event.match.groupId === gironeId;
  }
  if (event.type === "group-standings") {
    return event.group.stageId === stageId && event.group.id === gironeId;
  }
  // The Live bar shows the time of these too.
  if (event.type === "phase-started") return event.phase.stageId === stageId;
  if (event.type === "board-closed") return event.board.stageId === stageId;
  return false;
}
