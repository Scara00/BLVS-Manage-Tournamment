import type { LiveSync } from "@/lib/live/types";
import {
  classificaGirone,
  type PartitaGirone,
} from "@/lib/gironi/classifica/classifica";
import {
  vistaTabellone,
  type DatiTabellone,
  type GironeDati,
} from "@/lib/tabellone/dati";
import type { StageBoard } from "@/lib/tabellone/types";

/*
 * w-tabellone fixtures for stories and tests: one stage, the men's board
 * at every step. The player is «Luca Rossi» (`m1`).
 */

export const ME_FIXTURE = "m1";
export const AT_FIXTURE = "2027-06-12T08:30:00.000Z";

const NOMI: Record<string, string> = {
  m1: "Luca Rossi",
  m2: "Marco Bianchi",
  m3: "Paolo Marino",
  m4: "Andrea Greco",
  m5: "Matteo Ferrari",
  m6: "Davide Costa",
  m7: "Simone Esposito",
  m8: "Giovanni Romano Della Valle Santangelo",
  f1: "Giulia Colombo",
  f2: "Sara Ricci",
  f3: "Chiara Fontana",
  f4: "Marta Moretti",
};

function partita(
  id: string,
  [a, b, c, d]: readonly string[],
  sets: { a: number; b: number }[],
): PartitaGirone {
  return {
    id,
    stato: sets.length > 0 ? "conclusa" : "programmata",
    squadre: { A: [a, b], B: [c, d] },
    sets,
  };
}

/** A group of 4 King/Queen with `giocate` of its 3 matches played. */
function girone(
  id: string,
  nome: string,
  fase: GironeDati["fase"],
  ids: readonly string[],
  giocate: number,
  categoria: GironeDati["categoria"] = "M",
): GironeDati {
  const [p1, p2, p3, p4] = ids;
  const risultati = [
    [{ a: 21, b: 12 }],
    [{ a: 21, b: 17 }],
    [{ a: 23, b: 21 }],
  ];
  const partite = [
    partita(`${id}-1`, [p1, p2, p3, p4], giocate > 0 ? risultati[0] : []),
    partita(`${id}-2`, [p1, p3, p2, p4], giocate > 1 ? risultati[1] : []),
    partita(`${id}-3`, [p1, p4, p2, p3], giocate > 2 ? risultati[2] : []),
  ];
  return {
    id,
    nome,
    fase,
    categoria,
    giocatori: ids,
    classifica: giocate > 0 ? classificaGirone(ids, partite) : null,
  };
}

const A = ["m1", "m2", "m3", "m4"];
const B = ["m5", "m6", "m7", "m8"];
const F = ["f1", "f2", "f3", "f4"];

export type ScenarioTabellone =
  | "iscrizioni"
  | "gironi_iniziali"
  | "gironi_gold_silver"
  | "finali"
  | "conclusa";

function gironiDi(scenario: ScenarioTabellone): GironeDati[] {
  const iniziali = (giocate: number) => [
    girone("g-a", "Girone A", "iniziale", A, giocate),
    girone("g-b", "Girone B", "iniziale", B, giocate),
  ];
  const goldSilver = (giocate: number) => [
    girone("g-gold", "Gold A", "gold", ["m1", "m5", "m2", "m6"], giocate),
    girone("g-silver", "Silver A", "silver", ["m3", "m7", "m4", "m8"], giocate),
  ];
  const finali = (giocate: number) => [
    girone(
      "g-fg",
      "Finale gold",
      "finale_gold",
      ["m1", "m5", "m2", "m6"],
      giocate,
    ),
    girone(
      "g-fs",
      "Finale silver",
      "finale_silver",
      ["m3", "m7", "m4", "m8"],
      giocate,
    ),
  ];
  const femminile = girone("g-f", "Girone A", "iniziale", F, 1, "F");
  switch (scenario) {
    case "iscrizioni":
      return [];
    case "gironi_iniziali":
      return [...iniziali(1), femminile];
    case "gironi_gold_silver":
      return [...iniziali(3), ...goldSilver(1), femminile];
    case "finali":
      return [...iniziali(3), ...goldSilver(3), ...finali(1), femminile];
    case "conclusa":
      return [...iniziali(3), ...goldSilver(3), ...finali(3), femminile];
  }
}

const FASE_GIOCO: Record<
  ScenarioTabellone,
  DatiTabellone["tabelloni"][number]["faseGioco"]
> = {
  iscrizioni: null,
  gironi_iniziali: "gironi_iniziali",
  gironi_gold_silver: "gironi_gold_silver",
  finali: "finali",
  conclusa: "finali",
};

export function stageFixture(
  scenario: ScenarioTabellone,
  {
    note = new Map<string, string>(),
    statoTappa = scenario === "iscrizioni" ? "iscrizioni_chiuse" : "in_corso",
    change = null,
  }: {
    note?: Map<string, string>;
    statoTappa?: DatiTabellone["tappa"]["stato"];
    change?: string | null;
  } = {},
): StageBoard {
  return vistaTabellone(
    {
      tappa: { id: "t", nome: "Tappa 1 · Jesolo", stato: statoTappa },
      tabelloni: [
        {
          categoria: "M",
          faseGioco: FASE_GIOCO[scenario],
          conclusoIl: scenario === "conclusa" ? AT_FIXTURE : null,
        },
        {
          categoria: "F",
          faseGioco: scenario === "iscrizioni" ? null : "gironi_iniziali",
          conclusoIl: null,
        },
      ],
      gironi: gironiDi(scenario),
      nomi: new Map(Object.entries(NOMI)),
      note,
    },
    { change, updatedAt: AT_FIXTURE },
  );
}

export function syncFixture(stage: StageBoard): LiveSync {
  return {
    snapshot: {
      seq: 0,
      updatedAt: AT_FIXTURE,
      matches: [],
      groups: [],
      overall: [],
      pendingScores: [],
      stageBoards: [stage],
    },
    syncedAt: AT_FIXTURE,
  };
}
