"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  PRENDI_POSTO_INITIAL,
  type PrendiPostoState,
} from "@/lib/iscrizioni/prendi-posto-state";
import { PROFILO_MODIFICA_PATH } from "@/lib/profilo/types";
import type { TappaDettaglio } from "@/lib/tappe/dettaglio";

export type PrendiPostoAction = (
  prev: PrendiPostoState,
  formData: FormData,
) => Promise<PrendiPostoState>;

/**
 * «Prendi il posto N nel maschile». Active only when nothing blocks the
 * player; otherwise disabled but still focusable, with the reason as a
 * visible text linked through `aria-describedby`. The reason `<p>` is
 * rendered here, not via Button's `disabledReason`, so the button is not
 * remounted (and focus is kept) when a refused attempt disables it.
 */
export function PrendiPostoForm({
  tappa,
  action,
}: {
  tappa: TappaDettaglio;
  action: PrendiPostoAction;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    PRENDI_POSTO_INITIAL,
  );
  const reasonId = useId();
  const errorId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const blocked = tappa.motivo !== null;
  const attempt = state.status === "error" ? state.attempt : 0;

  useEffect(() => {
    if (attempt > 0) errorRef.current?.focus({ preventScroll: true });
  }, [attempt]);

  return (
    <form
      action={formAction}
      data-testid="prendi-posto"
      data-motivo={tappa.motivo ?? undefined}
      className="flex flex-col items-start gap-space-2"
    >
      <input type="hidden" name="tappaId" value={tappa.id} />
      <Button
        type="submit"
        size="campo"
        className="max-w-full"
        disabled={blocked}
        focusableWhenDisabled
        loading={pending}
        aria-describedby={
          [blocked ? reasonId : null, state.status === "error" ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {tappa.azione}
      </Button>
      {blocked ? (
        <p id={reasonId} className="max-w-prose text-foreground">
          {tappa.motivoTesto}{" "}
          {tappa.motivo === "categoria_mancante" ? (
            <Link
              href={PROFILO_MODIFICA_PATH}
              className="font-medium text-primary underline decoration-2 underline-offset-4 focus-ring"
            >
              Vai al profilo
            </Link>
          ) : null}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p
          id={errorId}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="max-w-prose border-l-4 border-error-fg bg-error-bg px-space-3 py-space-2 font-medium text-error-fg focus-ring"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
