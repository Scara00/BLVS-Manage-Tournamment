"use client";

import { BadgeCheckIcon } from "lucide-react";
import { useActionState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CAMBIO_MESSAGES } from "@/lib/giocatori/admin/errori";
import {
  CAMBIO_CATEGORIA_INITIAL,
  type CambioCategoriaAction,
} from "@/lib/giocatori/admin/types";

/** «Segna come verificata»: the category stops being «da verificare». */
export function VerificaCategoria({
  utenteId,
  daVerificare,
  action,
}: {
  utenteId: string;
  /** Without it only the last outcome stays (the page refreshed). */
  daVerificare: boolean;
  action: CambioCategoriaAction;
}) {
  const safeAction = useCallback<CambioCategoriaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch {
        return {
          status: "error",
          reason: "network",
          message: CAMBIO_MESSAGES.network,
          at: 0,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(
    safeAction,
    CAMBIO_CATEGORIA_INITIAL,
  );
  return (
    <form action={formAction} className="flex flex-col items-start gap-space-2">
      <input type="hidden" name="utenteId" value={utenteId} />
      {daVerificare ? (
        <Button
          type="submit"
          variant="secondary"
          className="max-w-full"
          aria-busy={pending || undefined}
          disabled={pending}
          focusableWhenDisabled
        >
          <BadgeCheckIcon aria-hidden className="size-4" />
          Segna la categoria come verificata
        </Button>
      ) : null}
      <p
        role="status"
        data-testid="esito-verifica"
        className={
          state.status === "error"
            ? "font-semibold text-error-fg"
            : "font-semibold"
        }
      >
        {state.status === "idle" ? "" : state.message}
      </p>
    </form>
  );
}
