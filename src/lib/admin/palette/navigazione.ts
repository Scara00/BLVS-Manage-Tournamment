/**
 * The active option after a key, over `n` options in reading order;
 * `null` = none active. Arrows wrap around, Home/End jump to the ends.
 * Any other key leaves it unchanged.
 */
export function prossimoAttivo(
  n: number,
  attivo: number | null,
  tasto: string,
): number | null {
  if (n === 0) return null;
  switch (tasto) {
    case "ArrowDown":
      return attivo === null || attivo >= n - 1 ? 0 : attivo + 1;
    case "ArrowUp":
      return attivo === null || attivo <= 0 ? n - 1 : attivo - 1;
    case "Home":
      return 0;
    case "End":
      return n - 1;
    default:
      return attivo !== null && attivo < n ? attivo : null;
  }
}

/** Ctrl+K (Windows, Linux) or Cmd+K (macOS), not while composing text. */
export function isScorciatoiaPalette(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}): boolean {
  if (event.isComposing || event.altKey || event.shiftKey) return false;
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";
}

/** The shortcut as shown next to «Cerca»: «⌘ K» on Apple devices. */
export function etichettaScorciatoia(platform: string): string {
  return /mac|iphone|ipad|ipod/i.test(platform) ? "⌘ K" : "Ctrl K";
}
