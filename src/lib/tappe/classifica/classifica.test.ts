import { describe, expect, it } from "vitest";
import type { FaseTabellone, StatoPartita } from "@/lib/db/types";
import { firmaParita, statisticheGirone } from "@/lib/gironi/classifica";
import type { PartitaGirone } from "@/lib/gironi/classifica";
import {
  classificaTappa,
  posizioniCerte,
  type FinaleTappa,
  type RigaClassificaTappa,
} from "./classifica";

let seq = 0;

/** A match; `x-y` is the A-B score of its single set, "" = not played. */
function partita(
  A: string[],
  B: string[],
  punteggio: string,
  stato: StatoPartita = punteggio ? "conclusa" : "programmata",
): PartitaGirone {
  const sets = punteggio
    ? [
        {
          a: Number(punteggio.split("-")[0]),
          b: Number(punteggio.split("-")[1]),
        },
      ]
    : [];
  return { id: `p${++seq}`, stato, squadre: { A, B }, sets };
}

/** The 3 King/Queen matches of a final of 4: AB–CD, AC–BD, AD–BC. */
function kingQueen(
  [a, b, c, d]: string[],
  punteggi: [string, string, string],
): PartitaGirone[] {
  return [
    partita([a, b], [c, d], punteggi[0]),
    partita([a, c], [b, d], punteggi[1]),
    partita([a, d], [b, c], punteggi[2]),
  ];
}

function finale(
  fase: FaseTabellone | null,
  ids: string[],
  partite: PartitaGirone[],
  extra: Partial<FinaleTappa> = {},
  ritirati: string[] = [],
): FinaleTappa {
  return {
    gironeId: `g-${fase}`,
    fase,
    giocatori: ids.map((id) => ({
      iscrizioneId: id,
      nome: `Giocatore ${id.toUpperCase()}`,
      ritirato: ritirati.includes(id),
    })),
    partite,
    ...extra,
  };
}

const sintesi = (righe: RigaClassificaTappa[]) =>
  righe.map((r) => [
    r.iscrizioneId,
    r.posizione,
    r.punti,
    r.posizioneDefinitiva,
  ]);

const GOLD = ["a", "b", "c", "d"];
const SILVER = ["e", "f", "g", "h"];

// a 3 wins; b, c, d 1 win each, split by point difference: d +2, b −8, c −14.
const GOLD_COMPLETA: [string, string, string] = ["21-15", "21-18", "21-10"];

describe("classificaTappa", () => {
  it("è in attesa senza finali", () => {
    expect(classificaTappa({ finali: [], concluso: false })).toEqual({
      righe: [],
      stato: "in_attesa",
      puntiProvvisori: true,
    });
  });

  it("mostra posizioni e punti provvisori prima della prima partita", () => {
    const c = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, ["", "", ""]))],
      concluso: false,
    });
    expect(c.stato).toBe("in_corso");
    expect(c.righe.every((r) => r.posizione === 1 && r.punti === 12)).toBe(
      true,
    );
    expect(c.righe.every((r) => !r.posizioneDefinitiva)).toBe(true);
    expect(c.righe.every((r) => r.puntiProvvisori)).toBe(true);
  });

  it("a finale in corso segue la classifica attuale, senza posizioni definitive", () => {
    const c = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, ["21-15", "21-18", ""]))],
      concluso: false,
    });
    expect(c.stato).toBe("in_corso");
    expect(sintesi(c.righe)).toEqual([
      ["a", 1, 12, false],
      ["b", 2, 8, false],
      ["c", 3, 4, false],
      ["d", 4, 2, false],
    ]);
  });

  it("a finale giocata le posizioni sono definitive ma i punti restano provvisori", () => {
    const c = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, GOLD_COMPLETA))],
      concluso: false,
    });
    expect(c.stato).toBe("definitiva");
    expect(c.puntiProvvisori).toBe(true);
    expect(sintesi(c.righe)).toEqual([
      ["a", 1, 12, true],
      ["d", 2, 8, true],
      ["b", 3, 4, true],
      ["c", 4, 2, true],
    ]);
    expect(c.righe.every((r) => r.puntiProvvisori)).toBe(true);
  });

  it("a tabellone chiuso i punti non sono più provvisori", () => {
    const c = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, GOLD_COMPLETA))],
      concluso: true,
    });
    expect(c.stato).toBe("conclusa");
    expect(c.puntiProvvisori).toBe(false);
    expect(c.righe.some((r) => r.puntiProvvisori)).toBe(false);
  });

  it("si ricalcola dopo una correzione del punteggio", () => {
    const prima = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, GOLD_COMPLETA))],
      concluso: false,
    });
    // The third match is corrected: B+C now beat A+D, so A, B and C have
    // 2 wins each and the point difference splits them: b +14, c +8, a −2.
    const dopo = classificaTappa({
      finali: [
        finale("gold", GOLD, kingQueen(GOLD, ["21-15", "21-18", "10-21"])),
      ],
      concluso: false,
    });
    expect(prima.righe[0].iscrizioneId).toBe("a");
    expect(dopo.righe.map((r) => [r.iscrizioneId, r.posizione])).toEqual([
      ["b", 1],
      ["c", 2],
      ["a", 3],
      ["d", 4],
    ]);
  });

  it("mette il ritirato ultimo della finale con i punti di quella posizione", () => {
    const c = classificaTappa({
      finali: [finale("gold", GOLD, kingQueen(GOLD, GOLD_COMPLETA), {}, ["d"])],
      concluso: false,
    });
    expect(sintesi(c.righe)).toEqual([
      ["a", 1, 12, true],
      ["b", 2, 8, true],
      ["c", 3, 4, true],
      ["d", 4, 2, true],
    ]);
    expect(c.righe.find((r) => r.iscrizioneId === "d")?.ritirato).toBe(true);
  });

  it("un ritiro a finale in corso è subito definitivo all'ultimo posto", () => {
    const c = classificaTappa({
      finali: [
        finale("gold", GOLD, kingQueen(GOLD, ["15-21", "", ""]), {}, ["a"]),
      ],
      concluso: false,
    });
    const a = c.righe.find((r) => r.iscrizioneId === "a")!;
    expect([a.posizione, a.punti, a.posizioneDefinitiva]).toEqual([4, 2, true]);
  });

  it("mette la finale silver dopo la gold, con la sua tabella punti", () => {
    const c = classificaTappa({
      finali: [
        finale("silver", SILVER, kingQueen(SILVER, GOLD_COMPLETA)),
        finale("gold", GOLD, kingQueen(GOLD, GOLD_COMPLETA)),
      ],
      concluso: false,
    });
    expect(
      c.righe.map((r) => [r.iscrizioneId, r.posizione, r.fase, r.punti]),
    ).toEqual([
      ["a", 1, "gold", 12],
      ["d", 2, "gold", 8],
      ["b", 3, "gold", 4],
      ["c", 4, "gold", 2],
      ["e", 5, "silver", 8],
      ["h", 6, "silver", 6],
      ["f", 7, "silver", 2],
      ["g", 8, "silver", 1],
    ]);
    expect(c.righe.find((r) => r.iscrizioneId === "e")?.posizioneFase).toBe(1);
  });

  it("non dà punti finché la fase gold/silver non è nota", () => {
    const c = classificaTappa({
      finali: [finale(null, GOLD, kingQueen(GOLD, GOLD_COMPLETA))],
      concluso: false,
    });
    expect(c.righe.map((r) => r.punti)).toEqual([null, null, null, null]);
    expect(c.righe[0].posizione).toBe(1);
  });

  describe("parità perfetta", () => {
    // Singles: x and y win one match each with the same scores.
    const partite = () => [
      partita(["x"], ["y"], "21-19"),
      partita(["x"], ["y"], "19-21"),
    ];

    it("resta non definitiva finché l'admin non decide", () => {
      const c = classificaTappa({
        finali: [finale("gold", ["x", "y"], partite())],
        concluso: false,
      });
      expect(c.stato).toBe("in_corso");
      expect(
        c.righe.map((r) => [r.posizione, r.daRisolvere, r.posizioneDefinitiva]),
      ).toEqual([
        [1, true, false],
        [1, true, false],
      ]);
    });

    it("diventa definitiva con la decisione dell'admin", () => {
      const giocate = partite();
      const firma = firmaParita(statisticheGirone(["x", "y"], giocate));
      const c = classificaTappa({
        finali: [
          finale("gold", ["x", "y"], giocate, {
            decisioni: [{ firma, ordine: ["y", "x"] }],
          }),
        ],
        concluso: false,
      });
      expect(sintesi(c.righe)).toEqual([
        ["y", 1, 12, true],
        ["x", 2, 8, true],
      ]);
    });
  });
});

describe("posizioniCerte", () => {
  it("fissa chi non può più essere raggiunto né superare", () => {
    // Singles round robin: a has beaten b and c; b–c still to play.
    const partite = [
      partita(["a"], ["b"], "21-10"),
      partita(["a"], ["c"], "21-12"),
      partita(["b"], ["c"], ""),
    ];
    expect([...posizioniCerte(["a", "b", "c"], partite)]).toEqual([["a", 1]]);
  });

  it("fissa anche l'ultimo quando nessuno può scendere sotto di lui", () => {
    const partite = [
      partita(["a"], ["c"], "21-10"),
      partita(["b"], ["c"], "21-12"),
      partita(["a"], ["b"], ""),
    ];
    expect(posizioniCerte(["a", "b", "c"], partite).get("c")).toBe(3);
    expect(posizioniCerte(["a", "b", "c"], partite).has("a")).toBe(false);
  });

  it("ignora le partite annullate", () => {
    const partite = [
      partita(["a"], ["b"], "21-10"),
      partita(["a"], ["b"], "", "annullata"),
    ];
    expect([...posizioniCerte(["a", "b"], partite)]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("in un King/Queen a 4 nulla è certo prima dell'ultima partita", () => {
    expect(
      posizioniCerte(GOLD, kingQueen(GOLD, ["21-15", "21-18", ""])).size,
    ).toBe(0);
  });
});
