"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Categoria } from "@/lib/db/types";
import { REGOLA_GIRONI, type RegolaGironi } from "@/lib/tappe/gironi";
import { avvisoGironiMessage } from "@/lib/tappe/nuova/types";

type AvvisoGironiProps = {
  id: string;
  categoria: Categoria;
  /** The maximum to warn about; `null` when there is nothing to say. */
  posti: number | null;
  onUsa: (posti: number) => void;
  regola?: RegolaGironi;
};

/**
 * The incomplete-groups warning next to a board's maximum. The status
 * region is always in the DOM, so screen readers announce the text once,
 * when it appears or changes; the «Usa N» buttons sit outside it.
 */
export function AvvisoGironi({
  id,
  categoria,
  posti,
  onUsa,
  regola = REGOLA_GIRONI,
}: AvvisoGironiProps) {
  const visibile = posti !== null;
  return (
    <div
      data-slot="avviso-gironi"
      className={
        visibile
          ? "flex flex-col items-start gap-space-3 border-l-4 border-tape bg-warning-bg p-inset text-warning-fg"
          : undefined
      }
    >
      <p
        id={id}
        role="status"
        className={
          visibile ? "flex items-start gap-space-2 font-semibold" : "sr-only"
        }
      >
        {visibile ? (
          <>
            <TriangleAlertIcon aria-hidden className="mt-1 size-4 shrink-0" />
            <span>
              <span className="sr-only">Avviso:</span>{" "}
              {avvisoGironiMessage(posti, regola.dimensione, categoria)}
            </span>
          </>
        ) : null}
      </p>
      {visibile ? (
        <div className="flex flex-wrap gap-space-2">
          {regola.proposte.map((proposta) => (
            <Button
              key={proposta}
              type="button"
              variant="secondary"
              className="max-w-full"
              onClick={() => onUsa(proposta)}
            >
              Usa <span className="font-mono">{proposta}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
