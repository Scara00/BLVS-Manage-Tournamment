"use client";

import { cn } from "cn";
import { useReducedMotion } from "./use-prefers-reduced-motion";

type TapeProps = {
  /** Thickness in px: the court line widths. */
  size?: 4 | 8;
  /** Plays the «scatta» snap on mount. */
  animated?: boolean;
  /** Overrides the OS `prefers-reduced-motion` setting. */
  reducedMotion?: boolean;
  className?: string;
};

/** The yellow court tape: decoration only, hidden from assistive tech. */
function Tape({
  size = 4,
  animated = false,
  reducedMotion,
  className,
}: TapeProps) {
  const reduce = useReducedMotion(reducedMotion);
  return (
    <span
      data-slot="tape"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "block w-full origin-left rounded-none bg-tape",
        size === 8 ? "h-2" : "h-1",
        animated && !reduce && "animate-tape-snap",
        className,
      )}
    />
  );
}

export { Tape, type TapeProps };
