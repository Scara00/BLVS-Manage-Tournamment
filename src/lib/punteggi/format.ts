import type { SetPunteggio } from "@/lib/db/types";
import type { ClassificaGirone } from "@/lib/gironi/classifica";
import type { GroupStandings, LiveMatch } from "@/lib/live/types";
import type { GiocatorePartita, PartitaPunteggio } from "./types";
import type { Lato } from "./validazione";

/** «Rinaldi/Moretti»: the surnames of a team, as on the scoreboard. */
export function nomeCoppia(giocatori: readonly GiocatorePartita[]): string {
  if (giocatori.length === 0) return "Coppia da definire";
  return giocatori.map((g) => g.cognome || g.nome).join("/");
}

/** «Luca Rinaldi e Marco Moretti», for screen readers and summaries. */
export function nomiCompleti(giocatori: readonly GiocatorePartita[]): string {
  return giocatori.map((g) => `${g.nome} ${g.cognome}`.trim()).join(" e ");
}

export function etichettaAggiungi(coppia: string): string {
  return `Aggiungi un punto a ${coppia}`;
}

export function etichettaTogli(coppia: string): string {
  return `Togli un punto a ${coppia}`;
}

export function etichettaCampo(coppia: string): string {
  return `Punti di ${coppia}`;
}

/** The single set of a match (R-32: one set to 21), or null. */
export function setPartita(sets: readonly SetPunteggio[]): SetPunteggio | null {
  return sets[0] ?? null;
}

/** A match with no valid result yet («da inserire»). */
export function daInserire(partita: Pick<PartitaPunteggio, "stato" | "sets">) {
  return (
    partita.stato !== "annullata" &&
    (partita.stato !== "conclusa" || partita.sets.length === 0)
  );
}

export function contaDaInserire(
  partite: readonly Pick<PartitaPunteggio, "stato" | "sets">[],
): number {
  return partite.filter(daInserire).length;
}

export function coppie(partita: PartitaPunteggio): Record<Lato, string> {
  return {
    a: nomeCoppia(partita.squadre.a),
    b: nomeCoppia(partita.squadre.b),
  };
}

/** «Rinaldi/Moretti 21 – 19 Conti/Gallo». */
export function descriviRisultato(
  partita: PartitaPunteggio,
  punti: SetPunteggio,
): string {
  const { a, b } = coppie(partita);
  return `${a} ${punti.a} – ${punti.b} ${b}`;
}

/** «Girone A · turno 2», plus the court when one is set. */
export function descriviPartita(partita: PartitaPunteggio): string {
  const base = `${partita.gironeNome} · turno ${partita.turno}`;
  return partita.campo ? `${base} · campo ${partita.campo}` : base;
}

function livePlayers(giocatori: readonly GiocatorePartita[]) {
  return giocatori.map((g) => ({
    id: g.iscrizioneId,
    name: `${g.nome} ${g.cognome}`.trim(),
  }));
}

/**
 * The live channel's shape: sets as `[home, away]` tuples. With `tappaId`
 * it also carries what the player live screen (BLVS-36) needs.
 */
export function toLiveMatch(
  partita: PartitaPunteggio,
  tappaId?: string,
): LiveMatch {
  const { a, b } = coppie(partita);
  return {
    ...(tappaId ? { stageId: tappaId } : {}),
    category: partita.categoria,
    round: partita.turno,
    state: partita.stato,
    players: {
      home: livePlayers(partita.squadre.a),
      away: livePlayers(partita.squadre.b),
    },
    id: partita.id,
    court: partita.campo ? `Campo ${partita.campo}` : `Turno ${partita.turno}`,
    groupId: partita.gironeId,
    groupLabel: partita.gironeNome,
    home: a,
    away: b,
    sets: partita.sets.map((s) => [s.a, s.b] as const),
  };
}

/**
 * The live standing of a group, from BLVS-27's computed standing. Points
 * are the points scored (King/Queen: each player gets the team's points).
 */
export function toGroupStandings(
  girone: { id: string; nome: string },
  classifica: ClassificaGirone,
  nomi: ReadonlyMap<string, string>,
  board?: { stageId: string; category: "M" | "F" },
): GroupStandings {
  return {
    id: girone.id,
    label: girone.nome,
    ...board,
    rows: classifica.righe.map((r) => ({
      position: r.posizione,
      playerId: r.iscrizioneId,
      pair: nomi.get(r.iscrizioneId) ?? r.iscrizioneId,
      played: r.giocate,
      won: r.vinte,
      points: r.puntiFatti,
    })),
  };
}

/** Player names of every match, by registration id. */
export function nomiGiocatori(
  partite: readonly PartitaPunteggio[],
): Map<string, string> {
  const nomi = new Map<string, string>();
  for (const p of partite) {
    for (const g of [...p.squadre.a, ...p.squadre.b]) {
      nomi.set(g.iscrizioneId, `${g.cognome} ${g.nome}`.trim());
    }
  }
  return nomi;
}
