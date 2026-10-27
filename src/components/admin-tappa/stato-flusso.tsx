import { CheckIcon } from "lucide-react";
import { Tape } from "@/components/scoreboard";
import type { PassoFlusso } from "@/lib/tappe/gestione-format";
import type { StatoFlusso } from "@/lib/tappe/stato";
import { cn } from "@/lib/utils";

const ATTUALE: Record<StatoFlusso, string> = {
  bozza: "bg-reg-draft-bg text-reg-draft-fg",
  iscrizioni_aperte: "bg-reg-open-bg text-reg-open-fg",
  iscrizioni_chiuse: "bg-reg-closed-bg text-reg-closed-fg",
};

const POSIZIONE = {
  fatto: "Completato",
  attuale: "Stato attuale",
  futuro: "Da fare",
} as const;

/**
 * bozza › aperte › chiuse as an ordered list. Each step shows its number,
 * its name and, in words, whether it is done, current or still to come:
 * the colour of the current step is never the only cue.
 */
export function StatoFlusso({
  flusso,
  nota,
}: {
  flusso: readonly PassoFlusso[];
  /** For states after the flow (in corso, conclusa, annullata). */
  nota?: string | null;
}) {
  return (
    <section
      aria-labelledby="stato-flusso-titolo"
      className="flex flex-col gap-stack-sm"
    >
      <div className="flex flex-col gap-space-2">
        <h2
          id="stato-flusso-titolo"
          className="font-heading text-xl font-semibold"
        >
          Stato delle iscrizioni
        </h2>
        <Tape size={4} className="max-w-24" />
      </div>
      <ol
        aria-labelledby="stato-flusso-titolo"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-space-2"
      >
        {flusso.map((passo) => {
          const attuale = passo.posizione === "attuale";
          return (
            <li
              key={passo.stato}
              aria-current={attuale ? "step" : undefined}
              data-posizione={passo.posizione}
              data-stato={passo.stato}
              className={cn(
                "flex items-start gap-space-3 border-2 p-inset",
                attuale
                  ? cn("border-primary", ATTUALE[passo.stato])
                  : passo.posizione === "fatto"
                    ? "border-input bg-background text-foreground"
                    : "border-dashed border-input bg-background text-foreground",
              )}
            >
              <span className="font-mono text-3xl leading-none font-semibold">
                {passo.indice}
                <span className="sr-only">.</span>
              </span>
              <span className="flex min-w-0 flex-col gap-space-1">
                <span
                  className={cn(
                    "font-heading text-lg [overflow-wrap:anywhere]",
                    attuale ? "font-bold" : "font-semibold",
                  )}
                >
                  {passo.label}
                </span>
                <span className="flex items-center gap-space-1 text-sm font-medium">
                  {passo.posizione === "fatto" ? (
                    <CheckIcon aria-hidden className="size-4 shrink-0" />
                  ) : null}
                  {POSIZIONE[passo.posizione]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {nota ? <p className="font-medium">{nota}</p> : null}
    </section>
  );
}
