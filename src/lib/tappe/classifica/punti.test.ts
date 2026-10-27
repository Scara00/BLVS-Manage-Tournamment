import { describe, expect, it } from "vitest";
import { PUNTI_PER_POSIZIONE, puntiPerPosizione } from "./punti";

describe("puntiPerPosizione", () => {
  it.each([
    [1, 12, 8],
    [2, 8, 6],
    [3, 4, 2],
    [4, 2, 1],
  ])("posizione %i: gold %i, silver %i", (posizione, gold, silver) => {
    expect(puntiPerPosizione("gold", posizione)).toBe(gold);
    expect(puntiPerPosizione("silver", posizione)).toBe(silver);
  });

  it("dà 0 punti oltre la tabella", () => {
    expect(puntiPerPosizione("gold", 5)).toBe(0);
    expect(puntiPerPosizione("silver", 9)).toBe(0);
  });

  it("rifiuta posizioni non valide", () => {
    expect(() => puntiPerPosizione("gold", 0)).toThrow();
    expect(() => puntiPerPosizione("gold", 1.5)).toThrow();
  });

  it("ha quattro posizioni a punti per fase", () => {
    expect(PUNTI_PER_POSIZIONE.gold).toHaveLength(4);
    expect(PUNTI_PER_POSIZIONE.silver).toHaveLength(4);
  });
});
