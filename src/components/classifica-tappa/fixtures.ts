import type { FaseTabellone, StatoPartita } from "@/lib/db/types";
import type { PartitaGirone } from "@/lib/gironi/classifica";
import type { LiveSync, StageStandings } from "@/lib/live/types";
import { classificaTappa, type FinaleTappa } from "@/lib/tappe/classifica";
import { toStageStandings } from "@/lib/tappe/classifica/live";

/*
 * Stage standings for stories and tests, computed with the real BLVS-40
 * rules: gold final a–d, silver final e–h (King/Queen groups of 4).
 */

export const TAPPA = "jesolo";
export const ME = "a";

const NOMI: Record<string, string> = {
  a: "Luca Rossi",
  b: "Marco Bianchi",
  c: "Davide Greco",
  d: "Paolo Marino",
  e: "Andrea Conti",
  f: "Simone Ricci",
  g: "Matteo Romano",
  h: "Niccolò Esposito",
};

/** `x-y` is the single set of a match, "" = still to play. */
function kingQueen(
  [a, b, c, d]: string[],
  punteggi: [string, string, string],
  aperta: StatoPartita = "programmata",
): PartitaGirone[] {
  const squadre = [
    [
      [a, b],
      [c, d],
    ],
    [
      [a, c],
      [b, d],
    ],
    [
      [a, d],
      [b, c],
    ],
  ];
  return squadre.map(([A, B], i) => {
    const p = punteggi[i];
    return {
      id: `${a}-t${i + 1}`,
      stato: p ? "conclusa" : aperta,
      squadre: { A, B },
      sets: p
        ? [{ a: Number(p.split("-")[0]), b: Number(p.split("-")[1]) }]
        : [],
    };
  });
}

function finale(
  fase: FaseTabellone,
  ids: string[],
  partite: PartitaGirone[],
  ritirati: string[] = [],
): FinaleTappa {
  return {
    gironeId: `g-${fase}`,
    fase,
    giocatori: ids.map((id) => ({
      iscrizioneId: id,
      nome: NOMI[id],
      ritirato: ritirati.includes(id),
    })),
    partite,
  };
}

const GOLD = ["a", "b", "c", "d"];
const SILVER = ["e", "f", "g", "h"];
/** a 3 wins; then d, b, c by point difference: no tie. */
const COMPLETA: [string, string, string] = ["21-15", "21-18", "21-10"];

function standings(
  finali: FinaleTappa[],
  concluso: boolean,
  change: string | null = null,
): StageStandings {
  return toStageStandings(classificaTappa({ finali, concluso }), {
    tappaId: TAPPA,
    categoria: "M",
    nome: "Tappa 1 · Jesolo",
    change,
  });
}

/** Both finals played, board still open: every place set, points provisional. */
export const definitiva = standings(
  [
    finale("gold", GOLD, kingQueen(GOLD, COMPLETA)),
    finale("silver", SILVER, kingQueen(SILVER, COMPLETA)),
  ],
  false,
);

/** Board closed: points final. */
export const conclusa = standings(
  [
    finale("gold", GOLD, kingQueen(GOLD, COMPLETA)),
    finale("silver", SILVER, kingQueen(SILVER, COMPLETA)),
  ],
  true,
);

/** The silver final's last match is on court: its places can still change. */
export const inCorso = standings(
  [
    finale("gold", GOLD, kingQueen(GOLD, COMPLETA)),
    finale(
      "silver",
      SILVER,
      kingQueen(SILVER, ["21-15", "21-18", ""], "in_corso"),
    ),
  ],
  false,
);

/** The gold final ends in a perfect three-way tie for 2nd place. */
export const parita = standings(
  [
    finale("gold", GOLD, kingQueen(GOLD, ["21-19", "21-19", "21-19"])),
    finale("silver", SILVER, kingQueen(SILVER, COMPLETA)),
  ],
  false,
);

/** A silver player withdrew: last of the final. */
export const ritiro = standings(
  [
    finale("gold", GOLD, kingQueen(GOLD, COMPLETA)),
    finale("silver", SILVER, kingQueen(SILVER, COMPLETA), ["e"]),
  ],
  false,
);

/** No final yet. */
export const inAttesa = standings([], false);

export function syncDi(
  s: StageStandings,
  updatedAt = "2026-07-18T08:00:00.000Z",
): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt,
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
      stageStandings: [s],
    },
    syncedAt: updatedAt,
  };
}
