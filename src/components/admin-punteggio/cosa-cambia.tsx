"use client";

import { cn } from "cn";
import { AlertCircleIcon, ArrowRightIcon } from "lucide-react";
import type { SetPunteggio } from "@/lib/db/types";
import type { CosaCambia as CosaCambiaValore } from "@/lib/punteggi/correzione/cosa-cambia";
import type { Lato } from "@/lib/punteggi/validazione";

function testoSet(set: SetPunteggio | null) {
  return set ? `${set.a}–${set.b}` : "—";
}

/**
 * Old value struck through next to the new one (w-admin-correzione). The
 * struck value is also named in words: `<del>` alone is not announced.
 */
export function ConfrontoPunteggio({
  vecchio,
  nuovo,
  className,
}: {
  vecchio: SetPunteggio | null;
  nuovo: Record<Lato, number | null>;
  className?: string;
}) {
  const completo =
    nuovo.a !== null &&
    nuovo.b !== null &&
    !Number.isNaN(nuovo.a) &&
    !Number.isNaN(nuovo.b);
  return (
    <p
      data-testid="confronto-punteggio"
      className={cn(
        "flex flex-wrap items-center gap-space-3 font-mono text-2xl font-bold tabular-nums",
        className,
      )}
    >
      <span className="sr-only">Valore precedente:</span>
      <del data-testid="valore-precedente" className="decoration-2">
        {testoSet(vecchio)}
      </del>
      <ArrowRightIcon aria-hidden className="size-6 shrink-0" />
      <span className="sr-only">nuovo valore:</span>
      <span
        data-testid="valore-nuovo"
        className={cn("px-space-2", completo && "bg-tape text-primary")}
      >
        {completo ? `${nuovo.a}–${nuovo.b}` : "—"}
      </span>
    </p>
  );
}

/**
 * «Cosa cambia»: the effects of the corrected values, listed as text. The
 * list follows every keystroke; the live region (when given) is filled by
 * the caller only after a typing pause, so it is read once.
 */
export function CosaCambia({
  id,
  cambio,
  vecchio,
  nuovo,
  annuncio,
}: {
  id: string;
  cambio: CosaCambiaValore;
  vecchio: SetPunteggio | null;
  nuovo: Record<Lato, number | null>;
  /** Text for the polite live region; omit for a static summary. */
  annuncio?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-titolo`}
      data-testid="cosa-cambia"
      className="flex flex-col gap-space-2 border-s-8 border-tape ps-space-3"
    >
      <h3 id={`${id}-titolo`} className="font-heading text-lg font-semibold">
        Cosa cambia
      </h3>
      <ConfrontoPunteggio vecchio={vecchio} nuovo={nuovo} />
      <ul className="flex flex-col gap-space-1">
        {cambio.voci.map((voce) => (
          <li
            key={voce.id}
            data-errore={voce.errore || undefined}
            className={cn(
              "flex items-start gap-space-2 [overflow-wrap:anywhere]",
              voce.errore && "font-semibold text-error-fg",
            )}
          >
            {voce.errore ? (
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
            ) : (
              <span aria-hidden className="font-mono">
                ·
              </span>
            )}
            <span>
              {voce.errore ? <span className="sr-only">Errore: </span> : null}
              {voce.testo}
            </span>
          </li>
        ))}
      </ul>
      {annuncio !== undefined ? (
        <p
          aria-live="polite"
          aria-atomic="true"
          data-testid="annuncio-cosa-cambia"
          className="sr-only"
        >
          {annuncio}
        </p>
      ) : null}
    </section>
  );
}
