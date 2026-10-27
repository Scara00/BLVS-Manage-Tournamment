"use client";

import { AlertCircleIcon } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Tape } from "@/components/scoreboard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  initialStagioneState,
  type StagioneAction,
  type StagioneState,
} from "@/lib/tappe/stagione/types";

/**
 * The season a stage counts for in the overall standing (BLVS-44, Q-06),
 * on w-admin-tappa. Defaults to the year of the stage; read-only once the
 * stage is archived.
 */
export function StagioneTappa({
  tappaId,
  stagione,
  modificabile,
  action,
  initialState = initialStagioneState,
}: {
  tappaId: string;
  stagione: number;
  modificabile: boolean;
  /** The `impostaStagioneTappa` server action (a fake in Storybook). */
  action: StagioneAction;
  initialState?: StagioneState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success") toast.add({ title: state.message });
    if (state.status === "error" && state.campo) inputRef.current?.focus();
  }, [state, toast]);

  const errore = state.status === "error" ? state : null;

  return (
    <section
      aria-labelledby="stagione-titolo"
      className="flex flex-col gap-stack-sm"
      data-testid="stagione-tappa"
    >
      <div className="flex flex-col gap-space-2">
        <h2 id="stagione-titolo" className="font-heading text-xl font-semibold">
          Stagione della classifica
        </h2>
        <Tape size={4} className="max-w-24" />
      </div>
      {modificabile ? (
        <form
          action={formAction}
          noValidate
          className="flex max-w-md flex-col gap-stack-sm"
        >
          <input type="hidden" name="tappaId" value={tappaId} />
          <Field
            label="Stagione"
            hint="L'anno della classifica generale in cui contano i punti di questa tappa."
            required
            error={errore?.campo}
          >
            <Input
              ref={inputRef}
              name="stagione"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              defaultValue={String(stagione)}
              className="max-w-32 font-mono"
            />
          </Field>
          {errore && !errore.campo ? (
            <p
              role="alert"
              className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset font-semibold text-error-fg"
            >
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {errore.message}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            className="self-start"
            loading={pending}
          >
            Salva la stagione
          </Button>
        </form>
      ) : (
        <p>
          Conta per la stagione{" "}
          <span className="font-mono font-semibold">{stagione}</span>. La tappa
          è archiviata: la stagione non si può più cambiare.
        </p>
      )}
    </section>
  );
}
