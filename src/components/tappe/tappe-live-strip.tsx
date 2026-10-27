import Link from "next/link";
import { Tape } from "@/components/scoreboard";
import { FASE_LABEL, type TappaGiocatore } from "@/lib/tappe/format";

/**
 * Shown at the top of the list while a stage is being played: which one,
 * its phase, and the way to the live results. A labelled region, not a live
 * one: it is read on demand.
 */
export function TappeLiveStrip({ tappa }: { tappa: TappaGiocatore }) {
  return (
    <section
      aria-labelledby="tappe-live-titolo"
      data-slot="tappe-live-strip"
      className="flex flex-col bg-primary text-primary-foreground"
    >
      <Tape size={8} />
      <div className="flex flex-wrap items-center gap-x-space-4 gap-y-space-2 p-inset">
        <p className="inline-flex items-center gap-space-2 bg-live-bg px-space-2 py-space-1 text-sm font-semibold tracking-wide text-live-fg uppercase">
          <span aria-hidden="true" className="size-2 rounded-full bg-live-fg" />
          Live
        </p>
        <h2
          id="tappe-live-titolo"
          className="min-w-0 flex-1 font-heading text-lg font-semibold [overflow-wrap:anywhere]"
        >
          {`In corso: ${tappa.name}`}
          {tappa.fase ? ` · Fase ${FASE_LABEL[tappa.fase]}` : null}
        </h2>
        <Link
          href="/live"
          className="inline-flex min-h-10 max-w-full items-center bg-tape px-space-4 font-heading font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          Segui la diretta
        </Link>
      </div>
    </section>
  );
}
