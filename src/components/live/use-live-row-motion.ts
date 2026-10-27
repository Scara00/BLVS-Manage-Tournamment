"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "@/components/scoreboard";

export const ROW_KEY_ATTR = "data-live-key";
export const ROW_SIGNATURE_ATTR = "data-live-signature";
/**
 * `outline` on dark rows (the player's own match): a tape outline flashes
 * instead of the background, which would put light text on tape-soft.
 */
export const ROW_HIGHLIGHT_ATTR = "data-live-highlight";

const HIGHLIGHT_MS = 1_200;
const MOVE_MS = 300;

/** Attributes that let `useLiveRowMotion` track a row across renders. */
export function liveRowAttributes(
  key: string,
  row: unknown,
): Record<`data-${string}`, string> {
  return {
    [ROW_KEY_ATTR]: key,
    [ROW_SIGNATURE_ATTR]: JSON.stringify(row),
  };
}

/**
 * Brief visual cue when live rows change: rows whose content changed flash
 * tape-soft, rows that moved slide from their old place (FLIP). With reduced
 * motion there is neither highlight nor reorder animation: rows just appear
 * in their new place.
 */
export function useLiveRowMotion(
  container: RefObject<HTMLElement | null>,
  reducedMotion?: boolean,
) {
  const still = useReducedMotion(reducedMotion);
  const previous = useRef(new Map<string, { top: number; sig: string }>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const rows = root.querySelectorAll<HTMLElement>(`[${ROW_KEY_ATTR}]`);
    const next = new Map<string, { top: number; sig: string }>();
    const origin = root.getBoundingClientRect().top;
    const styles = getComputedStyle(document.documentElement);
    const highlight = styles.getPropertyValue("--blvs-tape-soft").trim();
    const tape = styles.getPropertyValue("--blvs-tape").trim() || highlight;

    rows.forEach((el) => {
      const rect = el.getBoundingClientRect();
      // Hidden view (table on mobile, cards on desktop): nothing to animate.
      if (rect.width === 0 && rect.height === 0) return;
      const key = el.getAttribute(ROW_KEY_ATTR)!;
      const sig = el.getAttribute(ROW_SIGNATURE_ATTR) ?? "";
      const top = rect.top - origin;
      next.set(key, { top, sig });

      const before = previous.current.get(key);
      if (still || !before || typeof el.animate !== "function") return;
      const dy = before.top - top;
      if (dy !== 0) {
        el.animate(
          [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
          { duration: MOVE_MS, easing: "ease-out" },
        );
      }
      if (before.sig !== sig && highlight) {
        const outline = el.getAttribute(ROW_HIGHLIGHT_ATTR) === "outline";
        el.animate(
          outline
            ? [
                { outline: `4px solid ${tape}`, outlineOffset: "2px" },
                { outline: "4px solid transparent", outlineOffset: "2px" },
              ]
            : [
                { backgroundColor: highlight },
                { backgroundColor: "transparent" },
              ],
          { duration: HIGHLIGHT_MS, easing: "ease-in" },
        );
      }
    });
    previous.current = next;
  });
}
