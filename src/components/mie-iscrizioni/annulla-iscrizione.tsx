"use client";

import { XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  AnnullaIscrizioneAction,
  AnnullaIscrizioneState,
} from "@/lib/iscrizioni/annullamento/state";
import type { AnnullamentoView } from "@/lib/iscrizioni/annullamento/view";
import { cn } from "@/lib/utils";
import {
  AnnullaIscrizioneDialog,
  type EsitoDialog,
} from "./annulla-iscrizione-dialog";
import { EsitoAnnullamento } from "./esito-annullamento";

/** «Annulla l'iscrizione»: outlined on color.error, the dialog repeats it filled. */
export const annullaTriggerClassName =
  "max-w-full border-error-fg px-space-3 text-error-fg not-data-disabled:hover:bg-error-bg";

/** «Annulla entro 21 giugno, 23:59», or why the action is missing. */
export function ScadenzaAnnullamento({
  annullamento,
  id,
}: {
  annullamento: AnnullamentoView;
  id?: string;
}) {
  if (!annullamento.possibile) {
    return annullamento.motivoTesto ? (
      <p
        id={id}
        data-testid="annullamento-non-possibile"
        className="max-w-prose"
      >
        {annullamento.motivoTesto}
      </p>
    ) : null;
  }
  return (
    <p id={id} className="text-sm">
      {annullamento.scadenza && annullamento.scadenzaIso ? (
        <>
          Puoi annullare fino al{" "}
          <time
            dateTime={annullamento.scadenzaIso}
            className="font-mono tabular-nums"
          >
            {annullamento.scadenza}
          </time>
          .
        </>
      ) : (
        "Puoi annullare l'iscrizione."
      )}
    </p>
  );
}

/**
 * The cancel action of ONE registration (w-tappa, w-iscrizione-ok): the
 * deadline, «Annulla l'iscrizione» and its dialog, or the reason it is no
 * longer possible. Rendered also without a registration, so the result
 * message survives the refresh that removes the button. `dopo`: where to
 * go after a cancel (w-iscrizione-ok has nothing left to show).
 */
export function AnnullaIscrizione({
  annullamento,
  action,
  ritorno,
  dopo,
  initialState,
  className,
}: {
  annullamento: AnnullamentoView | null;
  action: AnnullaIscrizioneAction;
  ritorno: string;
  dopo?: string;
  initialState?: AnnullaIscrizioneState;
  className?: string;
}) {
  const router = useRouter();
  const esitoId = useId();
  const scadenzaId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<AnnullamentoView | null>(
    initialState?.status === "error" ? annullamento : null,
  );
  const [message, setMessage] = useState<string | null>(null);

  const onClose = useCallback(
    (esito: EsitoDialog) => {
      setTarget(null);
      if (!esito.annullata) return;
      setMessage(esito.message ?? null);
      if (dopo) router.replace(dopo);
    },
    [dopo, router],
  );

  return (
    <div
      className={cn("flex flex-col items-start gap-space-3", className)}
      data-testid="annulla-iscrizione"
    >
      <EsitoAnnullamento id={esitoId} message={message} />
      {annullamento ? (
        <>
          <ScadenzaAnnullamento annullamento={annullamento} id={scadenzaId} />
          {annullamento.possibile ? (
            <Button
              ref={trigger}
              variant="secondary"
              className={annullaTriggerClassName}
              aria-describedby={scadenzaId}
              onClick={() => setTarget(annullamento)}
            >
              <XCircleIcon aria-hidden />
              Annulla l&apos;iscrizione
            </Button>
          ) : null}
        </>
      ) : null}
      {/* Outside the condition: the refresh after a cancel removes the
          registration while the dialog is still closing. */}
      <AnnullaIscrizioneDialog
        target={target}
        onClose={onClose}
        returnFocus={trigger}
        esitoId={esitoId}
        ritorno={ritorno}
        action={action}
        initialState={initialState}
      />
    </div>
  );
}
