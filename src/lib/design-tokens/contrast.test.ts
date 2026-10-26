import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  formatRatio,
  hexToRgb,
  relativeLuminance,
  THRESHOLDS,
} from "./contrast";
import { contrastPairs } from "./tokens";

describe("contrasto WCAG", () => {
  it("converte hex corti e lunghi in RGB", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#ffcc00")).toEqual([255, 204, 0]);
    expect(() => hexToRgb("#zzzzzz")).toThrow();
  });

  it("calcola la luminanza relativa", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("restituisce i rapporti noti", () => {
    expect(contrastRatio("#000", "#fff")).toBe(21);
    expect(contrastRatio("#fff", "#000")).toBe(21);
    expect(contrastRatio("#777", "#fff")).toBeCloseTo(4.48, 2);
  });

  it("formatta senza arrotondare per eccesso", () => {
    expect(formatRatio(4.4999)).toBe("4.49:1");
  });

  it("il giallo tape non è mai testo su bianco", () => {
    expect(contrastRatio("#ffcc00", "#ffffff")).toBeLessThan(THRESHOLDS.text);
  });
});

describe("coppie dichiarate", () => {
  it.each(contrastPairs.map((p) => [p.name, p] as const))(
    "%s rispetta la soglia",
    (_name, pair) => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      const min = THRESHOLDS[pair.kind];
      expect(
        ratio,
        `"${pair.name}" (${pair.fg} su ${pair.bg}, ${pair.kind}) ha contrasto ${formatRatio(ratio)}, minimo ${min}:1`,
      ).toBeGreaterThanOrEqual(min);
    },
  );
});
