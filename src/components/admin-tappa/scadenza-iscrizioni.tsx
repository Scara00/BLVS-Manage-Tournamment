import { TimerIcon } from "lucide-react";
import type { ScadenzaView } from "@/lib/tappe/gestione-format";

/** Days to the deadline and, in words, that the closing is automatic. */
export function ScadenzaIscrizioni({ scadenza }: { scadenza: ScadenzaView }) {
  return (
    <div
      data-testid="scadenza-iscrizioni"
      className="flex flex-col gap-space-3 border-2 border-input p-inset md:p-inset-lg"
    >
      {scadenza.giorni !== null ? (
        <p className="flex flex-wrap items-baseline gap-x-space-2">
          <span className="font-mono text-5xl leading-none font-semibold">
            {scadenza.giorni}
          </span>
          <span className="font-heading text-lg font-semibold">
            {scadenza.giorni === 1 ? "giorno" : "giorni"} alla chiusura
          </span>
        </p>
      ) : null}
      <p className="font-heading text-lg font-semibold [overflow-wrap:anywhere]">
        {scadenza.titolo}
      </p>
      <p className="flex items-start gap-space-2 [overflow-wrap:anywhere]">
        {scadenza.automatica ? (
          <TimerIcon aria-hidden className="mt-1 size-4 shrink-0" />
        ) : null}
        {scadenza.dettaglio}
      </p>
    </div>
  );
}
