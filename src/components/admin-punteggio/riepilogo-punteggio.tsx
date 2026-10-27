"use client";

import { cn } from "cn";
import { CheckIcon, PencilIcon } from "lucide-react";
import type { FormEventHandler, RefObject } from "react";
import { Tape } from "@/components/scoreboard";
import { Button } from "@/components/ui/button";
import { coppie, nomiCompleti, setPartita } from "@/lib/punteggi/format";
import { PUNTEGGIO_MESSAGES } from "@/lib/punteggi/state";
import type { PartitaPunteggio } from "@/lib/punteggi/types";
import type { Lato } from "@/lib/punteggi/validazione";

type RiepilogoPunteggioProps = {
  partita: PartitaPunteggio;
  valori: Record<Lato, number | null>;
  vincitore: Lato | null;
  correzione: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  tappaId: string;
  versione: number;
  pending: boolean;
  online: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onModifica: () => void;
};

/**
 * w-admin-punteggio-riepilogo: the two pairs with their points and the
 * winner, before anything is written. «Conferma e salva» sends the score;
 * «Modifica» goes back to the fields with the values kept.
 */
export function RiepilogoPunteggio({
  partita,
  valori,
  vincitore,
  correzione,
  headingRef,
  tappaId,
  versione,
  pending,
  online,
  onSubmit,
  onModifica,
}: RiepilogoPunteggioProps) {
  const nomi = coppie(partita);
  const attuale = setPartita(partita.sets);
  return (
    <section
      aria-labelledby="riepilogo-punteggio-titolo"
      data-testid="riepilogo-punteggio"
      className="flex flex-col gap-stack-sm"
    >
      <h2
        id="riepilogo-punteggio-titolo"
        ref={headingRef}
        tabIndex={-1}
        className="self-start font-heading text-xl font-semibold focus-ring"
      >
        Riepilogo prima del salvataggio
      </h2>
      <Tape size={8} />
      <dl className="flex flex-col gap-space-2">
        {(["a", "b"] as const).map((lato) => {
          const vince = vincitore === lato;
          return (
            <div
              key={lato}
              data-vincitore={vince || undefined}
              className={cn(
                "flex flex-wrap items-center justify-between gap-space-3 border-2 border-primary p-inset",
                vince && "bg-tape text-primary",
              )}
            >
              <dt className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
                <span className="font-heading text-lg font-semibold">
                  {nomi[lato]}
                </span>
                <span className="text-sm">
                  {nomiCompleti(partita.squadre[lato])}
                </span>
              </dt>
              <dd className="flex items-center gap-space-3">
                {vince ? (
                  <span className="font-heading font-semibold">Vince</span>
                ) : null}
                <span className="font-mono text-4xl font-bold tabular-nums">
                  {valori[lato]}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      {correzione && attuale ? (
        <p data-testid="riepilogo-correzione">
          Sostituisce il punteggio salvato{" "}
          <span className="font-mono font-bold tabular-nums">
            {attuale.a}–{attuale.b}
          </span>
          : la correzione resta nel registro.
        </p>
      ) : (
        <p>
          Il salvataggio conclude la partita, aggiorna la classifica del girone
          e le pagine live.
        </p>
      )}
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-start gap-space-3"
      >
        <input type="hidden" name="tappaId" value={tappaId} />
        <input type="hidden" name="partitaId" value={partita.id} />
        <input type="hidden" name="versione" value={versione} />
        <input type="hidden" name="puntiA" value={valori.a ?? ""} />
        <input type="hidden" name="puntiB" value={valori.b ?? ""} />
        <Button
          type="submit"
          size="campo"
          className="max-w-full"
          loading={pending}
          disabled={!online}
          disabledReason={online ? undefined : PUNTEGGIO_MESSAGES.offline}
        >
          <CheckIcon aria-hidden />
          Conferma e salva
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="campo"
          className="max-w-full"
          disabled={pending}
          onClick={onModifica}
        >
          <PencilIcon aria-hidden />
          Modifica
        </Button>
      </form>
    </section>
  );
}
