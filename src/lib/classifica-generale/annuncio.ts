/**
 * The one short sentence w-classifica says per update (R-62): what
 * changed and, for a signed-in player, their place. Never the reordered
 * rows themselves.
 */
import type { Categoria } from "@/lib/db/types";
import type { LiveEvent, OverallStandings } from "@/lib/live/types";

const CATEGORIA: Record<Categoria, string> = {
  M: "maschile",
  F: "femminile",
};

export function titoloClassifica(categoria: Categoria): string {
  return `Classifica generale ${CATEGORIA[categoria]}`;
}

export function puntiLabel(punti: number): string {
  return punti === 1 ? "1 punto" : `${punti} punti`;
}

/** «12 punti provvisori», «1 punto provvisorio». */
export function puntiProvvisoriLabel(punti: number): string {
  return `${puntiLabel(punti)} ${punti === 1 ? "provvisorio" : "provvisori"}`;
}

export function annuncioClassifica(
  standings: OverallStandings,
  me: string | null,
): string {
  const parti = [`${titoloClassifica(standings.category)} aggiornata`];
  if (standings.change) parti.push(standings.change);
  const mia = me ? standings.rows.find((r) => r.playerId === me) : undefined;
  if (mia) {
    parti.push(
      `la tua posizione: ${mia.position}ª${mia.tied ? " a pari merito" : ""}, ${mia.provisional ? puntiProvvisoriLabel(mia.points) : puntiLabel(mia.points)}`,
    );
  }
  return parti.join(": ");
}

/** LiveAnnouncer `format` for w-classifica. */
export function annuncioEvento(event: LiveEvent, me: string | null): string {
  if (event.type === "overall-standings" && event.standings) {
    return annuncioClassifica(event.standings, me);
  }
  return "Classifica generale aggiornata";
}
