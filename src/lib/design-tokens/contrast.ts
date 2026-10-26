import type { ContrastKind } from "./tokens";

/** Minimum WCAG contrast ratio per pair kind. */
export const THRESHOLDS: Record<ContrastKind, number> = {
  /** Scores, standings, Live: AAA, read at a glance from a distance. */
  score: 7,
  /** Body text: AA. */
  text: 4.5,
  /** UI components and meaningful graphics (WCAG 1.4.11). */
  graphic: 3,
};

/** `#rgb` or `#rrggbb` → [r, g, b] in 0–255. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Colore non valido: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1 to 21. Order of the arguments does not matter. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

/** Ratio rounded down to 2 decimals, so a displayed value never overstates. */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
}
