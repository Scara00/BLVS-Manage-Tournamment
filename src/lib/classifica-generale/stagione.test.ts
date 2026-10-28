import { describe, expect, it } from "vitest";
import {
  parseStagione,
  stagioneDaData,
  stagioneLabel,
  stagioneScelta,
} from "./stagione";

describe("stagione", () => {
  it("accetta solo anni di quattro cifre nel campo valido", () => {
    expect(parseStagione("2026")).toBe(2026);
    expect(parseStagione(2025)).toBe(2025);
    expect(parseStagione(" 2027 ")).toBe(2027);
    for (const v of ["", "26", "1999", "2101", "20x6", null, undefined]) {
      expect(parseStagione(v)).toBeNull();
    }
  });

  it("la stagione predefinita è l'anno della tappa", () => {
    expect(stagioneDaData("2026-07-18")).toBe(2026);
  });

  it("mostra la stagione chiesta se esiste, altrimenti la più recente", () => {
    expect(stagioneScelta(2025, [2026, 2025], 2030)).toBe(2025);
    expect(stagioneScelta(2019, [2026, 2025], 2030)).toBe(2026);
    expect(stagioneScelta(null, [2025, 2026], 2030)).toBe(2026);
    expect(stagioneScelta(null, [], 2030)).toBe(2030);
  });

  it("etichetta", () => {
    expect(stagioneLabel(2026)).toBe("Stagione 2026");
    expect(stagioneLabel(null)).toBe("Tutte le stagioni");
  });
});
