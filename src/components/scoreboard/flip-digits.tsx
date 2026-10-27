"use client";

import { cn } from "cn";
import { useEffect, useState, type AnimationEvent } from "react";
import { useReducedMotion } from "./use-prefers-reduced-motion";

/** Top + bottom flap (see --animate-flip-* in globals.css), plus slack. */
const FLIP_FALLBACK_MS = 400;

/** U+2007: as wide as a digit, so blank padding keeps the board aligned. */
const FIGURE_SPACE = " ";

type FlipDigitsProps = {
  value: number | string;
  /** Pads on the left up to this many characters. */
  minDigits?: number;
  /** Padding character: leading zeros or blank flaps. */
  pad?: "zero" | "blank";
  /** The single text read by screen readers. Defaults to `String(value)`. */
  label?: string;
  /** Announces value changes politely. Off by default. */
  live?: boolean;
  /** Overrides the OS `prefers-reduced-motion` setting. */
  reducedMotion?: boolean;
  className?: string;
};

function FlipDigits({
  value,
  minDigits = 0,
  pad = "zero",
  label,
  live = false,
  reducedMotion,
  className,
}: FlipDigitsProps) {
  const reduce = useReducedMotion(reducedMotion);
  const text = String(value).padStart(
    minDigits,
    pad === "zero" ? "0" : FIGURE_SPACE,
  );
  const chars = [...text];

  return (
    <span
      data-slot="flip-digits"
      className={cn("inline-flex font-mono tabular-nums", className)}
    >
      <span
        className="sr-only"
        aria-live={live ? "polite" : undefined}
        aria-atomic={live ? true : undefined}
      >
        {label ?? String(value)}
      </span>
      <span aria-hidden="true" className="inline-flex gap-[0.08em]">
        {chars.map((char, i) =>
          /[\d ]/.test(char) ? (
            // Keyed from the right so a new leading digit does not reflip the rest.
            <FlipCell
              key={chars.length - i}
              char={char}
              reducedMotion={reduce}
            />
          ) : (
            <span
              key={chars.length - i}
              className="inline-flex h-[1.4em] items-center px-[0.05em] leading-none"
            >
              {char}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

const half =
  "absolute inset-x-0 h-1/2 overflow-hidden bg-primary backface-hidden";
const halfInner =
  "absolute inset-x-0 flex h-[200%] items-center justify-center";

function Half({
  side,
  char,
  className,
  onAnimationEnd,
}: {
  side: "top" | "bottom";
  char: string;
  className?: string;
  onAnimationEnd?: (event: AnimationEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      data-half={side}
      className={cn(
        half,
        side === "top" ? "top-0 origin-bottom" : "bottom-0 origin-top",
        className,
      )}
      onAnimationEnd={onAnimationEnd}
    >
      <span className={cn(halfInner, side === "top" ? "top-0" : "-top-full")}>
        {char}
      </span>
    </span>
  );
}

/** One split-flap cell: the old digit's top falls, the new bottom lands. */
function FlipCell({
  char,
  reducedMotion,
}: {
  char: string;
  reducedMotion: boolean;
}) {
  const [shown, setShown] = useState(char);
  const [previous, setPrevious] = useState<string | null>(null);
  const [flips, setFlips] = useState(0);

  // Derive the flip from the previous render (no effect, no extra commit).
  if (char !== shown) {
    setShown(char);
    setPrevious(reducedMotion ? null : shown);
    setFlips((n) => n + 1);
  } else if (reducedMotion && previous !== null) {
    // Reduced motion switched on mid-flip: drop the stale digit, or it
    // would replay when motion is allowed again.
    setPrevious(null);
  }
  const flipping = previous !== null && !reducedMotion;

  // animationend never fires in a hidden tab or without CSS: settle anyway.
  useEffect(() => {
    if (!flipping) return;
    const timer = setTimeout(() => setPrevious(null), FLIP_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [flipping, flips]);

  return (
    <span
      data-slot="flip-cell"
      className="relative inline-block h-[1.4em] w-[1.3ch] rounded-none bg-primary leading-none text-primary-foreground"
    >
      {flipping ? (
        <>
          <Half side="top" char={char} />
          <Half side="bottom" char={previous} />
          <Half
            key={`top-${flips}`}
            side="top"
            char={previous}
            className="z-10 animate-flip-top"
          />
          <Half
            key={`bottom-${flips}`}
            side="bottom"
            char={char}
            className="z-10 animate-flip-bottom"
            onAnimationEnd={() => setPrevious(null)}
          />
        </>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          {char}
        </span>
      )}
      {/* Hinge between the two flaps. */}
      <span className="absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-neutral-600" />
    </span>
  );
}

export { FlipDigits, type FlipDigitsProps };
