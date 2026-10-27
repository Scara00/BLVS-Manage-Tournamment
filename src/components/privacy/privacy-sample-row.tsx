"use client";

import { useEffect, useRef, useState } from "react";
import { FlipDigits, useReducedMotion } from "@/components/scoreboard";

export const SAMPLE_ROW = {
  position: 3,
  pair: "Rossi / Bianchi",
  points: 385,
} as const;

type Phase = "final" | "blank" | "flip";

/**
 * Example standings row («Pos.», «Coppia», «Punti») showing what is public.
 * The split-flap digits play once on mount and never again; with reduced
 * motion (and on the server) the final values render straight away.
 */
export function PrivacySampleRow({
  reducedMotion,
}: {
  /** Overrides the OS `prefers-reduced-motion` setting. */
  reducedMotion?: boolean;
}) {
  const reduce = useReducedMotion(reducedMotion);
  const [phase, setPhase] = useState<Phase>("final");
  const played = useRef(false);

  // Blank the flaps without animating, then flip them to the final values
  // on the next frame. Runs once: `played` survives re-renders.
  useEffect(() => {
    if (played.current || reduce) return;
    played.current = true;
    setPhase("blank");
    requestAnimationFrame(() => setPhase("flip"));
  }, [reduce]);

  const blank = phase === "blank" && !reduce;
  const digitMotion = blank ? true : reduce;

  return (
    <table className="w-full border-collapse">
      <caption className="pb-space-2 text-left text-sm text-muted-foreground">
        Esempio di riga in classifica
      </caption>
      <thead className="bg-primary text-primary-foreground">
        <tr className="border-b border-neutral-600 text-left text-sm font-semibold">
          <th scope="col" className="px-space-2 py-space-2">
            Pos.
          </th>
          <th scope="col" className="px-space-2 py-space-2">
            Coppia
          </th>
          <th scope="col" className="px-space-2 py-space-2 text-right">
            Punti
          </th>
        </tr>
      </thead>
      <tbody className="bg-primary text-primary-foreground">
        <tr className="text-lg sm:text-xl">
          <td className="px-space-2 py-space-3">
            <FlipDigits
              value={blank ? "" : SAMPLE_ROW.position}
              minDigits={1}
              pad="blank"
              label={String(SAMPLE_ROW.position)}
              reducedMotion={digitMotion}
            />
          </td>
          <th
            scope="row"
            className="px-space-2 py-space-3 text-left font-heading text-base font-semibold wrap-anywhere sm:text-lg"
          >
            {SAMPLE_ROW.pair}
          </th>
          <td className="px-space-2 py-space-3 text-right">
            <FlipDigits
              value={blank ? "" : SAMPLE_ROW.points}
              minDigits={3}
              pad="blank"
              label={String(SAMPLE_ROW.points)}
              reducedMotion={digitMotion}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
