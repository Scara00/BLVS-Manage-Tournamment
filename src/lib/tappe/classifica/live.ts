/**
 * The live shape of a stage standing (BLVS-49, w-classifica-tappa) and
 * the one short sentence said per update. Pure: used by the publisher,
 * the page and the tests.
 */
import { CATEGORIE, type Categoria, type FaseTabellone } from "@/lib/db/types";
import type {
  LiveEvent,
  StageStandingRow,
  StageStandings,
} from "@/lib/live/types";
import type { ClassificaTappa } from "./classifica";
import { PUNTI_PER_POSIZIONE } from "./punti";

const CATEGORIA: Record<Categoria, string> = {
  M: "maschile",
  F: "femminile",
};

export const FASE_FINALE_LABEL: Record<FaseTabellone, string> = {
  gold: "Finale gold",
  silver: "Finale silver",
};

/** `<stage id>:<M|F>`: the live id of one board's stage standing. */
export function idClassificaTappa(
  tappaId: string,
  categoria: Categoria,
): string {
  return `${tappaId}:${categoria}`;
}

/** Parses `<stage id>:<M|F>` (the snapshot route's `?classificaTappa=`). */
export function parseIdClassificaTappa(
  id: string,
): { tappaId: string; categoria: Categoria } | null {
  const i = id.lastIndexOf(":");
  if (i <= 0) return null;
  const categoria = id.slice(i + 1) as Categoria;
  if (!CATEGORIE.includes(categoria)) return null;
  return { tappaId: id.slice(0, i), categoria };
}

/** «M»/«F» from a query value (also «m»/«f»), or null. */
export function parseCategoriaTappa(valore: unknown): Categoria | null {
  const v = typeof valore === "string" ? valore.toUpperCase() : null;
  return CATEGORIE.includes(v as Categoria) ? (v as Categoria) : null;
}

export function titoloClassificaTappa(categoria: Categoria): string {
  return `Classifica di tappa ${CATEGORIA[categoria]}`;
}

/** «Tappa 1 · Jesolo, maschile». */
export function etichettaTabellone(nome: string, categoria: Categoria): string {
  return `${nome}, ${CATEGORIA[categoria]}`;
}

/** The live shape of a BLVS-40 stage standing. */
export function toStageStandings(
  classifica: ClassificaTappa,
  {
    tappaId,
    categoria,
    nome,
    change = null,
  }: {
    tappaId: string;
    categoria: Categoria;
    nome: string;
    change?: string | null;
  },
): StageStandings {
  return {
    id: idClassificaTappa(tappaId, categoria),
    stageId: tappaId,
    category: categoria,
    label: etichettaTabellone(nome, categoria),
    state: classifica.stato,
    provisional: classifica.puntiProvvisori,
    change,
    rows: classifica.righe.map((r): StageStandingRow => ({
      playerId: r.iscrizioneId,
      name: r.nome,
      phase: r.fase,
      position: r.posizione,
      phasePosition: r.posizioneFase,
      points: r.punti,
      definitive: r.posizioneDefinitiva,
      toResolve: r.daRisolvere,
      withdrawn: r.ritirato,
    })),
  };
}

/** Same rows and state, whatever the change text. */
function stessaClassifica(a: StageStandings, b: StageStandings): boolean {
  return (
    a.state === b.state &&
    a.provisional === b.provisional &&
    JSON.stringify(a.rows) === JSON.stringify(b.rows)
  );
}

/**
 * What changed from the last published standing, said once by the
 * announcer; undefined when nothing did (then nothing is published).
 * Without a previous standing (first publish since the server started)
 * it is null: the announcer says just «aggiornata».
 */
export function cambioClassificaTappa(
  prima: StageStandings | undefined,
  dopo: StageStandings,
): string | null | undefined {
  if (!prima) return null;
  if (stessaClassifica(prima, dopo)) return undefined;
  if (prima.provisional && !dopo.provisional) return "punti definitivi";
  const definitivePrima = new Set(
    prima.rows.filter((r) => r.definitive).map((r) => r.playerId),
  );
  const nuove = dopo.rows.filter(
    (r) => r.definitive && !definitivePrima.has(r.playerId),
  );
  if (nuove.length === 1) return `posizione definitiva per ${nuove[0].name}`;
  if (nuove.length > 1) return `${nuove.length} posizioni definitive`;
  return null;
}

export function puntiLabel(punti: number): string {
  return punti === 1 ? "1 punto" : `${punti} punti`;
}

/** «8 punti provvisori», «1 punto provvisorio», «12 punti». */
export function puntiRigaLabel(punti: number, provvisori: boolean): string {
  if (!provvisori) return puntiLabel(punti);
  return `${puntiLabel(punti)} ${punti === 1 ? "provvisorio" : "provvisori"}`;
}

/** The player's row, or undefined. */
export function rigaMia(
  standings: Pick<StageStandings, "rows"> | undefined,
  me: string | null,
): StageStandingRow | undefined {
  return me ? standings?.rows.find((r) => r.playerId === me) : undefined;
}

/**
 * The one short sentence per update (R-62): what changed and, for the
 * signed-in player, their place and points. Never the reordered rows.
 */
export function annuncioClassificaTappa(
  standings: StageStandings,
  me: string | null,
): string {
  const parti = [`${titoloClassificaTappa(standings.category)} aggiornata`];
  if (standings.change) parti.push(standings.change);
  const mia = rigaMia(standings, me);
  if (mia) {
    const tied = standings.rows.some(
      (r) => r.playerId !== mia.playerId && r.position === mia.position,
    );
    parti.push(
      `la tua posizione: ${mia.position}ª${tied ? " a pari merito" : ""}, ${puntiRigaLabel(mia.points ?? 0, standings.provisional)}`,
    );
  }
  return parti.join(": ");
}

/** LiveAnnouncer `format` for w-classifica-tappa. */
export function annuncioEventoTappa(
  event: LiveEvent,
  me: string | null,
): string {
  if (event.type === "stage-standings") {
    return annuncioClassificaTappa(event.standings, me);
  }
  return "Classifica di tappa aggiornata";
}

/** The events w-classifica-tappa folds in: its standing, its board closed. */
export function eventoDellaClassificaTappa(
  event: LiveEvent,
  id: string,
): boolean {
  if (event.type === "stage-standings") return event.standings.id === id;
  if (event.type === "board-closed") return event.board.id === id;
  return false;
}

/**
 * The standing as shown: a `board-closed` for the same board (BLVS-43)
 * makes the points final even before the next standing arrives, so
 * «provvisori» disappears within the live budget either way.
 */
export function classificaMostrata(
  standings: StageStandings | undefined,
  chiusa: boolean,
): StageStandings | undefined {
  if (!standings || !chiusa || !standings.provisional) return standings;
  return { ...standings, provisional: false, state: "conclusa" };
}

/** «12, 8, 4, 2»: the points per position of one final, from config. */
export function puntiPerPosizioneTesto(fase: FaseTabellone): string {
  return PUNTI_PER_POSIZIONE[fase].join(", ");
}
