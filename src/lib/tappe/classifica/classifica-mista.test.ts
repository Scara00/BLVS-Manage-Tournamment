import { describe, expect, it } from "vitest";
import type { PartitaGirone } from "@/lib/gironi/classifica";
import { classificaTappa, type FinaleTappa } from "./classifica";

/**
 * A mixed final of 2 men + 2 women, played: in every match the team of
 * `vince` (a man and a woman) wins 21-15, so the order is clear.
 */
function finale(
  id: string,
  fase: "gold" | "silver",
  [m1, m2, f1, f2]: [string, string, string, string],
): FinaleTappa {
  const partita = (n: number, a: string[], b: string[]): PartitaGirone => ({
    id: `${id}-${n}`,
    stato: "conclusa",
    squadre: { A: a, B: b },
    sets: [{ a: 21, b: 15 }],
  });
  return {
    gironeId: id,
    fase,
    giocatori: [
      { iscrizioneId: m1, nome: `Uomo ${m1}`, ritirato: false, categoria: "M" },
      { iscrizioneId: m2, nome: `Uomo ${m2}`, ritirato: false, categoria: "M" },
      {
        iscrizioneId: f1,
        nome: `Donna ${f1}`,
        ritirato: false,
        categoria: "F",
      },
      {
        iscrizioneId: f2,
        nome: `Donna ${f2}`,
        ritirato: false,
        categoria: "F",
      },
    ],
    // m1 e f1 vincono 2 partite su 3, m2 e f2 una: tra gli uomini m1 è
    // davanti, tra le donne f1. In una classifica unica m1 e f1 sarebbero
    // pari perfetti (anche negli scontri diretti), e così m2 e f2.
    partite: [
      partita(1, [m1, f1], [m2, f2]),
      partita(2, [m1, f2], [m2, f1]),
      partita(3, [f1, m2], [f2, m1].reverse()),
    ],
  };
}

describe("classificaTappa nel misto: uomini e donne a parte", () => {
  const gold = finale("g", "gold", ["a", "b", "c", "d"]);
  const silver = finale("s", "silver", ["e", "f", "g", "h"]);
  const classifica = classificaTappa({
    finali: [silver, gold],
    concluso: true,
    senzaPunti: true,
  });

  it("ogni finale ha i suoi posti da 1 per uomini e per donne", () => {
    expect(
      classifica.righe.map((r) => [
        r.fase,
        r.categoria,
        r.iscrizioneId,
        r.posizione,
        r.posizioneFase,
      ]),
    ).toEqual([
      ["gold", "M", "a", 1, 1],
      ["gold", "M", "b", 2, 2],
      ["gold", "F", "c", 1, 1],
      ["gold", "F", "d", 2, 2],
      // La silver riparte dopo i 2 uomini e le 2 donne della gold.
      ["silver", "M", "e", 3, 1],
      ["silver", "M", "f", 4, 2],
      ["silver", "F", "g", 3, 1],
      ["silver", "F", "h", 4, 2],
    ]);
  });

  it("nessun punto e nessuna parità tra un uomo e una donna", () => {
    expect(classifica.righe.every((r) => r.punti === null)).toBe(true);
    expect(classifica.righe.some((r) => r.daRisolvere)).toBe(false);
    expect(classifica.stato).toBe("conclusa");
  });

  it("senza categorie la finale è una classifica unica, con le parità uomo-donna", () => {
    const classica = classificaTappa({
      finali: [
        {
          ...gold,
          giocatori: gold.giocatori.map((g) => ({
            iscrizioneId: g.iscrizioneId,
            nome: g.nome,
            ritirato: g.ritirato,
          })),
        },
      ],
      concluso: true,
    });
    expect(classica.righe.every((r) => r.categoria === undefined)).toBe(true);
    expect(classica.righe.map((r) => r.posizione)).toEqual([1, 1, 3, 3]);
    expect(classica.righe.every((r) => r.daRisolvere)).toBe(true);
  });
});
