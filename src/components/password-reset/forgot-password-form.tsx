"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NETWORK_MESSAGE,
  OFFLINE_MESSAGE,
  postJson,
  type PostOutcome,
} from "@/lib/auth/password-reset/client";
import { FormAlert, PasswordFrame } from "./password-frame";
import { ForgotPasswordSent } from "./forgot-password-sent";

/** Status of a password form while it is shown. */
export type FormStatus = "idle" | "loading" | "offline" | "network" | "error";

export type ForgotPasswordFormViewProps = {
  status: FormStatus;
  /** Server message for `error`. */
  message?: string;
  /** Error of the email field (client or server validation). */
  emailError?: string;
  defaultEmail?: string;
  /** The user arrived from an expired or already used reset link. */
  linkExpired?: boolean;
  /** Bumped on every failed submit: moves focus to the first error. */
  failedAttempts?: number;
  /** Focus the h1 on mount (back from «Usa un altro indirizzo»). */
  focusHeading?: boolean;
  onSubmit?: (email: string) => void;
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Client check, same rule as the API (`BodyReader.email`). */
export function emailError(email: string): string | undefined {
  if (!email.trim()) return "Inserisci la tua email.";
  if (!EMAIL_PATTERN.test(email.trim()))
    return "Inserisci un'email valida, es. nome@esempio.it.";
  return undefined;
}

function statusMessage(status: FormStatus, message?: string) {
  if (status === "offline") return OFFLINE_MESSAGE;
  if (status === "network") return NETWORK_MESSAGE;
  if (status === "error") return message;
  return undefined;
}

/** w-forgot: asks the email that will receive the reset link. */
export function ForgotPasswordFormView({
  status,
  message,
  emailError: fieldError,
  defaultEmail,
  linkExpired = false,
  failedAttempts = 0,
  focusHeading = false,
  onSubmit,
}: ForgotPasswordFormViewProps) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (failedAttempts > 0 && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [failedAttempts]);

  const alert = statusMessage(status, message);

  return (
    <PasswordFrame
      title="Password dimenticata"
      focusHeading={focusHeading}
      description={
        <p>
          Scrivi l&apos;email del tuo account: ti mandiamo un link per
          sceglierne una nuova.
        </p>
      }
    >
      {linkExpired ? (
        <p className="border-l-4 border-info-fg bg-info-bg px-space-4 py-space-3 text-info-fg">
          <strong>Il link che hai aperto è scaduto o è già stato usato.</strong>{" "}
          Chiedine uno nuovo qui sotto.
        </p>
      ) : null}
      <form
        ref={formRef}
        noValidate
        aria-label="Richiedi il link per reimpostare la password"
        className="flex flex-col gap-space-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onSubmit?.(String(data.get("email") ?? ""));
        }}
      >
        <Field label="Email" required error={fieldError}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            defaultValue={defaultEmail}
          />
        </Field>
        {alert ? <FormAlert>{alert}</FormAlert> : null}
        <div>
          <Button type="submit" loading={status === "loading"}>
            Invia il link
          </Button>
        </div>
      </form>
    </PasswordFrame>
  );
}

type RequestResult = PostOutcome<{ messaggio: string }>;

/** Sends the request to the API (swapped by tests and stories). */
export function requestResetLink(email: string): Promise<RequestResult> {
  return postJson("/api/auth/password/richiesta", { email });
}

type FlowState = {
  view: "form" | "sent";
  email: string;
  status: FormStatus;
  message?: string;
  emailError?: string;
  failedAttempts: number;
  /** Back on the form from w-forgot-sent. */
  returned?: boolean;
};

/** w-forgot → w-forgot-sent, with «Invia di nuovo». */
export function ForgotPasswordFlow({
  linkExpired = false,
  request = requestResetLink,
}: {
  linkExpired?: boolean;
  request?: (email: string) => Promise<RequestResult>;
}) {
  const [state, setState] = useState<FlowState>({
    view: "form",
    email: "",
    status: "idle",
    failedAttempts: 0,
  });

  async function submit(raw: string) {
    if (state.status === "loading") return;
    const email = raw.trim();
    const invalid = emailError(email);
    if (invalid) {
      setState((s) => ({
        ...s,
        email,
        status: "idle",
        emailError: invalid,
        failedAttempts: s.failedAttempts + 1,
      }));
      return;
    }
    setState((s) => ({
      ...s,
      email,
      status: "loading",
      emailError: undefined,
    }));
    const outcome = await request(email);
    setState((s) => {
      switch (outcome.kind) {
        case "ok":
          return { ...s, view: "sent", status: "idle" };
        case "fields":
          return {
            ...s,
            status: "idle",
            emailError: outcome.fields.email ?? outcome.message,
            failedAttempts: s.failedAttempts + 1,
          };
        case "offline":
        case "network":
          return { ...s, status: outcome.kind };
        default:
          return { ...s, status: "error", message: outcome.message };
      }
    });
  }

  if (state.view === "sent") {
    return (
      <ForgotPasswordSent
        email={state.email}
        focusHeading
        onResend={() => request(state.email)}
        onChangeEmail={() =>
          setState((s) => ({
            ...s,
            view: "form",
            status: "idle",
            returned: true,
          }))
        }
      />
    );
  }

  return (
    <ForgotPasswordFormView
      status={state.status}
      message={state.message}
      emailError={state.emailError}
      defaultEmail={state.email}
      linkExpired={linkExpired}
      failedAttempts={state.failedAttempts}
      focusHeading={state.returned}
      onSubmit={submit}
    />
  );
}
