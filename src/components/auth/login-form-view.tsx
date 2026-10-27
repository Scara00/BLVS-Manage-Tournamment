"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActionLink } from "@/components/error-page/action-link";
import { Tape } from "@/components/scoreboard";
import { Button } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth/password-reset/messages";
import { signupHref } from "@/lib/auth/paths";
import type { SignInState } from "@/lib/auth/sign-in-state";
import { RETURN_PARAM } from "@/lib/navigation/safe-return-path";
import { useRetryCountdown } from "./use-retry-countdown";

/** Why the user landed on the login page. */
export type LoginNotice =
  | { kind: "uscita"; draftsCleared?: number }
  | { kind: "scaduta"; destination: string }
  | null;

export type LoginFormViewProps = {
  state: SignInState;
  /** The form action (from `useActionState`); stories pass a noop. */
  formAction?: (formData: FormData) => void;
  pending?: boolean;
  /** Safe internal path to go back to after signing in (`?da=`). */
  returnTo?: string;
  notice?: LoginNotice;
  /** Shown after a successful login, while the next page loads. */
  redirectingTo?: string;
  /** «Esci» for the permission-denied state (signed in, wrong role). */
  signOutAction?: (formData: FormData) => void;
};

const linkClass =
  "font-semibold underline decoration-1 underline-offset-4 focus-ring hover:decoration-2";

const FORM_ERRORS = new Set<SignInState["status"]>([
  "invalid",
  "rateLimited",
  "permissionDenied",
  "unavailable",
]);

/**
 * w-login: email + password. Native autocomplete hints (username,
 * current-password) let password managers fill it; paste is never blocked
 * and there is no cognitive test. After a failed attempt focus goes to the
 * first invalid field, or to the form-level error.
 */
export function LoginFormView({
  state,
  formAction,
  pending = false,
  returnTo,
  notice = null,
  redirectingTo,
  signOutAction,
}: LoginFormViewProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const waiting = useRetryCountdown(
    state.status === "rateLimited" ? state.retryAt : undefined,
  );
  const formError = !FORM_ERRORS.has(state.status)
    ? undefined
    : state.status === "rateLimited" && !waiting
      ? "L'attesa è finita: puoi riprovare ad accedere."
      : state.message;

  // After the errors have rendered, take the user to them, on every attempt.
  useEffect(() => {
    if (state.attempt === 0) return;
    if (state.status === "fieldErrors" && formRef.current)
      focusFirstInvalid(formRef.current);
    else if (FORM_ERRORS.has(state.status)) errorRef.current?.focus();
  }, [state.attempt, state.status]);

  const rateLimitedNow = state.status === "rateLimited" && waiting;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-stack-lg px-inset py-space-6 md:py-space-8">
      <header className="flex flex-col gap-space-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Accedi
        </h1>
        <Tape size={8} className="max-w-24" />
        <p className="text-lg text-pretty">
          Usa l&apos;email e la password del tuo account BLVS.
        </p>
      </header>

      <Notice notice={notice} />

      {redirectingTo ? (
        <p
          role="status"
          className="flex items-start gap-space-2 border-l-4 border-success-fg bg-success-bg p-inset-sm font-semibold text-success-fg"
        >
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
          Accesso effettuato. Ti stiamo portando a {redirectingTo}.
        </p>
      ) : null}

      {formError ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          data-slot="login-error"
          data-status={state.status}
          className="flex flex-col gap-space-3 border-l-4 border-error-fg bg-error-bg p-inset-sm text-error-fg focus-ring"
        >
          <p className="flex items-start gap-space-2 font-semibold">
            <AlertCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>
              <span className="sr-only">Errore: </span>
              {state.status === "rateLimited" && waiting ? (
                <RateLimitedText message={formError} />
              ) : (
                formError
              )}
            </span>
          </p>
          {state.status === "permissionDenied" ? (
            <div className="flex flex-wrap gap-space-3">
              <ActionLink href="/" variant="primary" className="max-w-full">
                Vai alla home
              </ActionLink>
              {signOutAction ? (
                <form action={signOutAction}>
                  <Button type="submit" variant="secondary">
                    <LogOutIcon aria-hidden />
                    Esci e cambia account
                  </Button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <form
        ref={formRef}
        action={formAction}
        method="post"
        noValidate
        aria-label="Accedi"
        className="flex flex-col gap-space-5"
      >
        {returnTo && returnTo !== "/" ? (
          <input type="hidden" name={RETURN_PARAM} value={returnTo} />
        ) : null}
        <Field label="Email" required error={state.fieldErrors?.email}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            defaultValue={state.email}
            // A new value from the server (e.g. a fresh attempt) remounts it.
            key={`email-${state.attempt}`}
          />
        </Field>
        <Field label="Password" required error={state.fieldErrors?.password}>
          <div className="flex items-stretch gap-space-2">
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-pressed={showPassword}
              aria-label="Mostra password"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? (
                <EyeOffIcon aria-hidden />
              ) : (
                <EyeIcon aria-hidden />
              )}
            </Button>
          </div>
        </Field>
        <Button
          type="submit"
          className="self-start"
          loading={pending}
          disabled={Boolean(rateLimitedNow)}
          disabledReason={
            rateLimitedNow
              ? "Il pulsante si riattiva da solo allo scadere dell'attesa."
              : undefined
          }
        >
          Accedi
        </Button>

        <p className="text-base">
          <Link href={FORGOT_PASSWORD_PATH} className={linkClass}>
            Password dimenticata?
          </Link>
        </p>
        <p className="text-base">
          Non hai un account?{" "}
          <Link href={signupHref(returnTo)} className={linkClass}>
            Registrati
          </Link>
        </p>
      </form>
    </div>
  );
}

/** The wait time set in the mono face, as on the scoreboard. */
function RateLimitedText({ message }: { message: string }) {
  const match = /^(.*?Riprova tra )(.+?)(, dalle )(\d{1,2}[.:]\d{2})(\.)$/.exec(
    message,
  );
  if (!match) return message;
  const [, before, wait, middle, time, end] = match;
  return (
    <>
      {before}
      <span className="font-mono">{wait}</span>
      {middle}
      <time className="font-mono">{time}</time>
      {end}
    </>
  );
}

function Notice({ notice }: { notice: LoginNotice }): ReactNode {
  if (!notice) return null;
  if (notice.kind === "uscita")
    return (
      <div
        role="status"
        data-slot="login-notice"
        className="flex items-start gap-space-2 border-l-4 border-success-fg bg-success-bg p-inset-sm text-success-fg"
      >
        <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong className="font-semibold">
            Sei uscito dall&apos;account.
          </strong>{" "}
          {notice.draftsCleared
            ? "Le bozze salvate su questo dispositivo sono state eliminate."
            : "Per continuare accedi di nuovo."}
        </p>
      </div>
    );
  return (
    <div
      role="status"
      data-slot="login-notice"
      className="flex flex-col gap-space-1 border-l-4 border-primary bg-tape-soft p-inset-sm text-foreground"
    >
      <p className="font-semibold">La sessione è scaduta.</p>
      <p>
        Accedi di nuovo: dopo l&apos;accesso torni a{" "}
        <strong className="font-semibold">{notice.destination}</strong>.
      </p>
    </div>
  );
}
