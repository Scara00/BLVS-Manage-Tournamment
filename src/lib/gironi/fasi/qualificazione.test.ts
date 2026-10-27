import { describe, expect, it } from "vitest";
import type { FaseGirone } from "@/lib/db/types";
import {
  classificaGirone,
  type DecisioneSpareggio,
} from "@/lib/gironi/classifica";
import {
  componiGironi,
  proponiFinali,
  proponiGoldSilver,
  proposta,
  type GironeClassificato,
} from "./qualificazione";
import { REGOLA_FINALI } from "./regole";

/** A wins every round: margins that give A, B, C, D in this order. */
const NETTO = [
  { a: 21, b: 10 },
  { a: 21, b: 12 },
  { a: 21, b: 14 },
];
/** 21-19 every round: B, C and D end in a perfect tie. */
const PARI = [
  { a: 21, b: 19 },
  { a: 21, b: 19 },
  { a: 21, b: 19 },
];
const ROTAZIONE = [
  [
    ["A", "B"],
    ["C", "D"],
  ],
  [
    ["A", "C"],
    ["B", "D"],
  ],
  [
    ["A", "D"],
    ["B", "C"],
  ],
] as const;

function girone(
  nome: string,
  fase: FaseGirone = "iniziale",
  {
    sets = NETTO,
    giocate = 3,
    decisioni = [],
  }: {
    sets?: { a: number; b: number }[];
    giocate?: number;
    decisioni?: DecisioneSpareggio[];
  } = {},
): GironeClassificato {
  const lettera = nome.at(-1)!;
  const id = (l: string) => `${fase}-${lettera}${l}`;
  const iscrizioni = ["A", "B", "C", "D"].map(id);
  const partite = ROTAZIONE.map(([a, b], t) => ({
    id: `${nome}-t${t + 1}`,
    stato: t < giocate ? ("conclusa" as const) : ("programmata" as const),
    squadre: { A: a.map(id), B: b.map(id) },
    sets: t < giocate ? [sets[t]] : [],
  }));
  return {
    id: `g-${fase}-${lettera}`,
    nome,
    fase,
    nomi: Object.fromEntries(iscrizioni.map((i) => [i, `Nome ${i}`])),
    classifica: classificaGirone(iscrizioni, partite, { decisioni }),
  };
}

const ids = (g: { giocatori: { iscrizioneId: string }[] }) =>
  g.giocatori.map((p) => p.iscrizioneId);

describe("componiGironi", () => {
  it("con 4 gironi nessuno ritrova un giocatore del suo girone", () => {
    expect(
      componiGironi(["A1", "B1", "C1", "D1"], ["A2", "B2", "C2", "D2"]),
    ).toEqual([
      ["A1", "B1", "C2", "D2"],
      ["C1", "D1", "A2", "B2"],
    ]);
  });

  it("con 2 gironi fa un girone con i 4 qualificati", () => {
    expect(componiGironi(["A1", "B1"], ["A2", "B2"])).toEqual([
      ["A1", "B1", "A2", "B2"],
    ]);
  });

  it("con un numero dispari di gironi lascia un ultimo girone da 2", () => {
    expect(componiGironi(["A1", "B1", "C1"], ["A2", "B2", "C2"])).toEqual([
      ["A1", "B1", "C2", "A2"],
      ["C1", "B2"],
    ]);
  });
});

describe("qualificazione gold/silver", () => {
  it("1° e 2° vanno nei gironi gold, 3° e 4° nei silver", () => {
    const esito = proponiGoldSilver([
      girone("Girone A"),
      girone("Girone B"),
      girone("Girone C"),
      girone("Girone D"),
    ]);
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi.map((g) => [g.fase, g.nome])).toEqual([
      ["gold", "Gold A"],
      ["gold", "Gold B"],
      ["silver", "Silver A"],
      ["silver", "Silver B"],
    ]);
    expect(ids(esito.gironi[0])).toEqual([
      "iniziale-AA",
      "iniziale-BA",
      "iniziale-CB",
      "iniziale-DB",
    ]);
    expect(ids(esito.gironi[2])).toEqual([
      "iniziale-AC",
      "iniziale-BC",
      "iniziale-CD",
      "iniziale-DD",
    ]);
    expect(esito.gironi[0].giocatori[2].provenienza).toBe("2° Girone C");
    expect(esito.avvisi).toEqual([]);
    expect(proposta(esito.gironi)[0]).toEqual({
      fase: "gold",
      iscrizioni: ids(esito.gironi[0]),
    });
  });

  it("avvisa del girone incompleto con un numero dispari di gironi", () => {
    const esito = proponiGoldSilver([
      girone("Girone A"),
      girone("Girone B"),
      girone("Girone C"),
    ]);
    expect(esito.esito === "ok" && esito.avvisi).toEqual([
      "Gold B: 2 giocatori invece di 4. Completalo nell'editor prima dell'avvio.",
      "Silver B: 2 giocatori invece di 4. Completalo nell'editor prima dell'avvio.",
    ]);
  });

  it("aspetta finché manca un punteggio", () => {
    expect(
      proponiGoldSilver([
        girone("Girone A"),
        girone("Girone B", "iniziale", { giocate: 2 }),
      ]),
    ).toEqual({
      esito: "in_corso",
      gironi: [{ id: "g-iniziale-B", nome: "Girone B" }],
    });
  });
});

describe("blocco per parità", () => {
  it("una parità da risolvere blocca la proposta e indica il girone", () => {
    const esito = proponiGoldSilver([
      girone("Girone A", "iniziale", { sets: PARI }),
      girone("Girone B"),
    ]);
    expect(esito).toEqual({
      esito: "parita",
      gironi: [{ id: "g-iniziale-A", nome: "Girone A" }],
    });
  });

  it("dopo la risoluzione la proposta parte", () => {
    const aperta = girone("Girone A", "iniziale", { sets: PARI });
    const parita = aperta.classifica!.parita[0];
    const risolta = girone("Girone A", "iniziale", {
      sets: PARI,
      decisioni: [
        {
          firma: parita.firma,
          ordine: ["iniziale-AD", "iniziale-AB", "iniziale-AC"],
        },
      ],
    });
    const esito = proponiGoldSilver([risolta, girone("Girone B")]);
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    // A first, then the admin's order: D 2nd goes to gold, B and C silver.
    expect(ids(esito.gironi[0])).toContain("iniziale-AD");
    expect(ids(esito.gironi[1])).toEqual(
      expect.arrayContaining(["iniziale-AB", "iniziale-AC"]),
    );
  });

  it("blocca anche le finali", () => {
    expect(
      proponiFinali([
        girone("Gold A", "gold", { sets: PARI }),
        girone("Silver A", "silver"),
      ]).esito,
    ).toBe("parita");
  });
});

describe("generazione delle finali", () => {
  it("con 2 gironi per colore: i primi 2 di ognuno in una finale da 4", () => {
    const esito = proponiFinali([
      girone("Gold A", "gold"),
      girone("Gold B", "gold"),
      girone("Silver A", "silver"),
      girone("Silver B", "silver"),
    ]);
    expect(esito.esito).toBe("ok");
    if (esito.esito !== "ok") return;
    expect(esito.gironi.map((g) => [g.fase, g.nome])).toEqual([
      ["finale_gold", "Finale gold"],
      ["finale_silver", "Finale silver"],
    ]);
    expect(ids(esito.gironi[0])).toEqual([
      "gold-AA",
      "gold-BA",
      "gold-AB",
      "gold-BB",
    ]);
    expect(esito.gironi[1].giocatori).toHaveLength(REGOLA_FINALI.giocatori);
    expect(esito.gironi[1].giocatori[0].provenienza).toBe("1° Silver A");
  });

  it("con 4 gironi per colore va in finale il primo di ognuno", () => {
    const esito = proponiFinali(
      ["A", "B", "C", "D"].map((l) => girone(`Gold ${l}`, "gold")),
    );
    expect(esito.esito === "ok" && ids(esito.gironi[0])).toEqual([
      "gold-AA",
      "gold-BA",
      "gold-CA",
      "gold-DA",
    ]);
  });

  it("con 3 gironi di un colore la finale non si compone", () => {
    const esito = proponiFinali(
      ["A", "B", "C"].map((l) => girone(`Gold ${l}`, "gold")),
    );
    expect(esito.esito).toBe("non_componibile");
  });
});
