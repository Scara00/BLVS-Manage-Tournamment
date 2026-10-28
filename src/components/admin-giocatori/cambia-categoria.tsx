"use client";

import { ArrowLeftRightIcon, CheckCircle2Icon } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Categoria } from "@/lib/db/types";
import type {
  CambioCategoriaAction,
  CambioCategoriaState,
  EffettiCambio,
} from "@/lib/giocatori/admin/types";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";
import { cn } from "@/lib/utils";
import {
  CambioCategoriaDialog,
  type EsitoCambio,
} from "./cambio-categoria-dialog";

/**
 * The outcome of a change, where focus lands once the dialog closes. Always
 * in the DOM so the status region exists before its text changes.
 */
export function EsitoCambioCategoria({
  id,
  message,
}: {
  id: string;
  message: string | null;
}) {
  return (
    <div
      id={id}
      tabIndex={-1}
      role="status"
      data-testid="esito-cambio-categoria"
      className={cn(
        "focus-ring",
        message
          ? "flex items-start gap-space-2 border-2 border-primary p-inset font-semibold"
          : "sr-only",
      )}
    >
      {message ? (
        <>
          <CheckCircle2Icon aria-hidden className="mt-1 size-5 shrink-0" />
          <p>{message}</p>
        </>
      ) : null}
    </div>
  );
}

/**
 * «Cambia in …» for each category the player is not in, and the one
 * confirmation dialog of the page. The effects come from the page on every
 * render, so after a refresh the open dialog shows the current ones.
 */
export function CambiaCategoria({
  utenteId,
  nome,
  cambi,
  action,
  initialState,
  initialAperto = null,
}: {
  utenteId: string;
  nome: string;
  cambi: readonly EffettiCambio[];
  action: CambioCategoriaAction;
  initialState?: CambioCategoriaState;
  /** Storybook: the dialog open on this category. */
  initialAperto?: Categoria | null;
}) {
  const esitoId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [aperto, setAperto] = useState<Categoria | null>(initialAperto);
  const [message, setMessage] = useState<string | null>(null);

  const onClose = useCallback((esito: EsitoCambio) => {
    setAperto(null);
    if (esito.cambiata) setMessage(esito.message ?? null);
  }, []);

  const effetti = cambi.find((c) => c.a === aperto) ?? null;

  return (
    <div className="flex flex-col items-start gap-space-3">
      <EsitoCambioCategoria id={esitoId} message={message} />
      <div className="flex flex-wrap gap-space-3">
        {cambi.map((c) => (
          <Button
            key={c.a}
            variant="primary"
            className="max-w-full"
            data-testid={`cambia-categoria-${c.a}`}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setAperto(c.a);
            }}
          >
            <ArrowLeftRightIcon aria-hidden className="size-4" />
            Cambia in {CATEGORIA_LABEL[c.a].toLowerCase()}
          </Button>
        ))}
      </div>
      <CambioCategoriaDialog
        utenteId={utenteId}
        nome={nome}
        effetti={effetti}
        onClose={onClose}
        returnFocus={trigger}
        esitoId={esitoId}
        action={action}
        initialState={initialState}
      />
    </div>
  );
}
