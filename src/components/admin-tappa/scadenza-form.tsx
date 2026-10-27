"use client";

import { AlertCircleIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  GESTIONE_MESSAGES,
  gestioneTappaPath,
  initialScadenzaState,
  type ScadenzaAction,
  type ScadenzaState,
} from "@/lib/tappe/gestione-state";

type ScadenzaFormProps = {
  tappaId: string;
  /** Current deadline as `datetime-local` value (Europe/Rome), or "". */
  valore: string;
  /** The `aggiornaScadenzaTappa` server action (a fake in Storybook). */
  action: ScadenzaAction;
  offline?: boolean;
  initialState?: ScadenzaState;
};

/** Sets the registration deadline, in Italian time. */
export function ScadenzaForm({
  tappaId,
  valore,
  action,
  offline: forceOffline,
  initialState = initialScadenzaState,
}: ScadenzaFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const offlineId = useId();

  const safeAction = useCallback<ScadenzaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[tappe] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: GESTIONE_MESSAGES.network,
          fields: {},
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  // Every failed submit is a new state object: move focus each time.
  useEffect(() => {
    if (
      state.status === "error" &&
      state.fields.chiudonoIl &&
      formRef.current
    ) {
      focusFirstInvalid(formRef.current);
    }
    if (state.status === "success") toast.add({ title: state.message });
  }, [state, toast]);

  const errore = state.status === "error" ? state : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={(event) => {
        if (!online || pending) event.preventDefault();
      }}
      className="flex max-w-md flex-col gap-stack-sm"
    >
      <input type="hidden" name="tappaId" value={tappaId} />
      <Field
        label="Scadenza delle iscrizioni"
        hint="Data e ora italiane. A quell'ora le iscrizioni si chiudono automaticamente."
        required
        error={errore?.fields.chiudonoIl}
      >
        <Input
          name="chiudonoIl"
          type="datetime-local"
          defaultValue={valore}
          className="font-mono"
        />
      </Field>
      {errore && !errore.fields.chiudonoIl ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
        >
          <p className="flex items-start gap-space-2 font-semibold">
            <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {errore.message}
          </p>
          {errore.reason === "sessionExpired" ? (
            <Link
              href={sessionExpiredHref(gestioneTappaPath(tappaId))}
              className={buttonVariants({ variant: "primary" })}
            >
              Accedi di nuovo
            </Link>
          ) : null}
        </div>
      ) : null}
      {!online ? (
        <p id={offlineId} className="flex items-start gap-space-2 font-medium">
          <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
          {GESTIONE_MESSAGES.offline}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        loading={pending}
        disabled={!online}
        focusableWhenDisabled
        aria-describedby={!online ? offlineId : undefined}
      >
        Salva la scadenza
      </Button>
    </form>
  );
}
