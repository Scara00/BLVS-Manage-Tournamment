"use client";

import { CheckIcon, PencilLineIcon, PlayIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  descriviPartita,
  setsLabel,
  squadraLabel,
  vincitore,
} from "@/lib/tappe/live-admin/format";
import {
  LIVE_ADMIN_MESSAGES,
  type OperazionePartita,
} from "@/lib/tappe/live-admin/state";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";
import { StatoPartitaBadge } from "./stato-partita";

export type AzioniVoce = {
  /** Hidden fields shared by every form of the match. */
  campi: ReactNode;
  /** Submits «Inizia» / «Concludi» through the page's action. */
  onOperazione: (formData: FormData) => void;
  /** Which match and operation is being saved, for the spinner. */
  inAttesa: { partitaId: string; operazione: OperazionePartita } | null;
  disabled: boolean;
  describedBy?: string;
  /** The score dialog trigger for this match. */
  punteggio: ReactNode;
};

function Operazione({
  partita,
  operazione,
  azioni,
  children,
  bloccata,
}: {
  partita: PartitaLive;
  operazione: OperazionePartita;
  azioni: AzioniVoce;
  children: ReactNode;
  /** Visible reason why this operation cannot run yet. */
  bloccata?: string | null;
}) {
  const loading =
    azioni.inAttesa?.partitaId === partita.id &&
    azioni.inAttesa.operazione === operazione;
  const verbo = operazione === "inizia" ? "Inizia" : "Concludi";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (azioni.disabled || bloccata || azioni.inAttesa) return;
        azioni.onOperazione(new FormData(event.currentTarget));
      }}
      className="contents"
    >
      {azioni.campi}
      <input type="hidden" name="operazione" value={operazione} />
      <Button
        type="submit"
        variant={operazione === "inizia" ? "primary" : "secondary"}
        size="campo"
        className="max-w-full"
        loading={loading}
        disabled={azioni.disabled || Boolean(bloccata)}
        disabledReason={azioni.disabled ? undefined : bloccata}
        focusableWhenDisabled
        aria-describedby={azioni.disabled ? azioni.describedBy : undefined}
        aria-label={`${verbo}: ${descriviPartita(partita)}`}
      >
        {children}
      </Button>
    </form>
  );
}

/**
 * One match: where and when, its state as text, the two teams, the score
 * and the admin's actions (all ≥ 48 px). A match whose result is due
 * carries a tape band with an icon and «Punteggio da inserire».
 */
export function PartitaVoce({
  partita,
  daInserire,
  azioni,
}: {
  partita: PartitaLive;
  daInserire: boolean;
  azioni: AzioniVoce;
}) {
  const titoloId = `partita-${partita.id}-titolo`;
  const punteggio = setsLabel(partita.sets);
  return (
    <article
      aria-labelledby={titoloId}
      data-testid="partita"
      data-partita={partita.id}
      data-stato={partita.stato}
      data-da-inserire={daInserire || undefined}
      className="flex h-full flex-col gap-space-3 border-2 border-neutral-200 bg-background p-inset data-[stato=in_corso]:border-live-fg"
    >
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <p
          id={titoloId}
          className="font-heading font-semibold [overflow-wrap:anywhere]"
        >
          {descriviPartita(partita)}
          {partita.campo ? (
            <span className="font-normal"> · {partita.campo}</span>
          ) : null}
        </p>
        <StatoPartitaBadge stato={partita.stato} />
      </div>
      {daInserire ? (
        <p className="flex items-center gap-space-2 bg-tape px-space-2 py-space-1 font-heading font-semibold text-primary">
          <PencilLineIcon aria-hidden className="size-4 shrink-0" />
          Punteggio da inserire
        </p>
      ) : null}
      <p className="flex flex-wrap items-baseline gap-x-space-2 [overflow-wrap:anywhere]">
        <span className="font-semibold">{squadraLabel(partita.squadraA)}</span>
        <span>contro</span>
        <span className="font-semibold">{squadraLabel(partita.squadraB)}</span>
      </p>
      {punteggio ? (
        <p>
          <span className="sr-only">Punteggio: </span>
          <span className="font-mono text-lg font-semibold">{punteggio}</span>
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-start gap-space-2">
        {partita.stato === "programmata" ? (
          <Operazione partita={partita} operazione="inizia" azioni={azioni}>
            <PlayIcon aria-hidden />
            Inizia
          </Operazione>
        ) : null}
        {partita.stato === "in_corso" || partita.stato === "conclusa"
          ? azioni.punteggio
          : null}
        {partita.stato === "in_corso" ? (
          <Operazione
            partita={partita}
            operazione="concludi"
            azioni={azioni}
            bloccata={
              vincitore(partita.sets)
                ? null
                : LIVE_ADMIN_MESSAGES.senzaVincitore
            }
          >
            <CheckIcon aria-hidden />
            Concludi
          </Operazione>
        ) : null}
      </div>
    </article>
  );
}
