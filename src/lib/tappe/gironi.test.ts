import { describe, expect, it } from "vitest";
import { fasiGironi, gironiCompleti, REGOLA_GIRONI } from "./gironi";

describe("fasiGironi (gironi da 4, passano 2)", () => {
  it.each([
    [4, [1]],
    [8, [2, 1]],
    [16, [4, 2, 1]],
    [32, [8, 4, 2, 1]],
    [64, [16, 8, 4, 2, 1]],
  ])("%i iscritti: gironi completi in tutte le fasi", (iscritti, fasi) => {
    expect(fasiGironi(iscritti)).toEqual({ completi: true, fasi });
  });

  it.each([
    [12, [3]],
    [20, [5]],
    [24, [6, 3]],
    [48, [12, 6, 3]],
    [30, []],
    [3, []],
    [0, []],
  ])("%i iscritti: una fase ha gironi incompleti", (iscritti, fasi) => {
    expect(fasiGironi(iscritti)).toEqual({ completi: false, fasi });
  });

  it("un valore non intero non è mai completo", () => {
    expect(gironiCompleti(16.5)).toBe(false);
    expect(gironiCompleti(Number.NaN)).toBe(false);
  });

  it("propone 16 e 32", () => {
    expect(REGOLA_GIRONI.proposte).toEqual([16, 32]);
    for (const proposta of REGOLA_GIRONI.proposte) {
      expect(gironiCompleti(proposta)).toBe(true);
    }
  });
});

describe("regola configurabile", () => {
  const daTre = { dimensione: 3, qualificati: 1, proposte: [9, 27] };

  it("gironi da 3 con un solo qualificato", () => {
    expect(fasiGironi(27, daTre)).toEqual({ completi: true, fasi: [9, 3, 1] });
    expect(gironiCompleti(12, daTre)).toBe(false);
  });

  it("rifiuta una regola che non riduce i giocatori", () => {
    expect(() =>
      fasiGironi(16, { dimensione: 4, qualificati: 4, proposte: [] }),
    ).toThrow();
  });
});
