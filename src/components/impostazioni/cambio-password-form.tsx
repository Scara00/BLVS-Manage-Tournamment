"use client";

import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { PasswordRequirements } from "@/components/password-reset/password-requirements";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { checkPassword } from "@/lib/auth/password-policy";
import { profiloSessionExpiredHref } from "@/lib/profilo/paths";
import {
  IMPOSTAZIONI_PATH,
  initialCambioPasswordState,
  type CambioPasswordAction,
  type CambioPasswordState,
} from "@/lib/impostazioni/types";

export const ALTRE_SESSIONI_NOTA =
  "Salvando, chiudiamo le sessioni aperte sugli altri dispositivi. Su questo resti connesso.";

/**
 * «Password» on w-impostazioni: the current password, then the new one
 * twice with the live ✓/✕ requirements. Errors sit under each field and
 * focus moves to the first one.
 */
export function CambioPasswordForm({
  action,
  initialState = initialCambioPasswordState,
}: {
  /** The `cambiaPassword` server action (a fake in Storybook). */
  action: CambioPasswordAction;
  initialState?: CambioPasswordState;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const ids = useId();
  const requisitiId = `${ids}-requisiti`;
  const notaId = `${ids}-nota`;
  const [password, setPassword] = useState("");
  const [conferma, setConferma] = useState("");
  const [attuale, setAttuale] = useState("");
  const [visibili, setVisibili] = useState(false);

  // After a save the fields start empty again (adjusting state in render).
  const [statoVisto, setStatoVisto] = useState(state);
  if (state !== statoVisto) {
    setStatoVisto(state);
    if (state.status === "success") {
      setAttuale("");
      setPassword("");
      setConferma("");
    }
  }

  useEffect(() => {
    if (state.status === "error" && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [state]);

  const fields = state.status === "error" ? state.fields : {};
  const tipo = visibili ? "text" : "password";

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      aria-labelledby="impostazioni-password-titolo"
      className="flex max-w-xl flex-col gap-space-5"
    >
      {state.status === "sessionExpired" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
        >
          <p className="flex items-start gap-space-2 font-semibold">
            <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {state.message}
          </p>
          <Link
            href={profiloSessionExpiredHref(IMPOSTAZIONI_PATH)}
            className={buttonVariants({ variant: "primary" })}
          >
            Accedi di nuovo
          </Link>
        </div>
      ) : null}

      <Field label="Password attuale" required error={fields.attuale}>
        <Input
          name="attuale"
          type={tipo}
          autoComplete="current-password"
          spellCheck={false}
          value={attuale}
          onValueChange={setAttuale}
        />
      </Field>
      <Field label="Nuova password" required error={fields.password}>
        <Input
          name="password"
          type={tipo}
          autoComplete="new-password"
          spellCheck={false}
          aria-describedby={requisitiId}
          value={password}
          onValueChange={setPassword}
        />
      </Field>
      <Field label="Ripeti la nuova password" required error={fields.conferma}>
        <Input
          name="conferma"
          type={tipo}
          autoComplete="new-password"
          spellCheck={false}
          value={conferma}
          onValueChange={setConferma}
        />
      </Field>
      <div>
        <Button
          type="button"
          variant="link"
          aria-pressed={visibili}
          onClick={() => setVisibili((v) => !v)}
        >
          Mostra le password
        </Button>
      </div>
      <PasswordRequirements
        id={requisitiId}
        results={checkPassword(password, conferma)}
      />

      {state.status === "error" ? (
        <p
          // Field errors are reached by focus; a general failure has no
          // field, so it is announced.
          role={Object.keys(fields).length === 0 ? "alert" : undefined}
          className="flex items-start gap-space-2 font-semibold text-error-fg"
        >
          <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p
          role="status"
          className="flex items-start gap-space-2 border-l-4 border-success-fg bg-success-bg px-space-4 py-space-3 text-success-fg"
        >
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-space-2">
        <Button type="submit" loading={pending} aria-describedby={notaId}>
          Cambia password
        </Button>
        <p id={notaId} className="max-w-prose text-sm text-muted-foreground">
          {ALTRE_SESSIONI_NOTA}
        </p>
      </div>
    </form>
  );
}
