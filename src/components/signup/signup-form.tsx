"use client";

import { AlertCircleIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Fieldset, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import type { FieldErrors } from "@/lib/api/responses";
import { EMAIL_TAKEN_MESSAGE, MIN_PASSWORD_LENGTH } from "@/lib/auth/messages";
import { loginHref, SIGNUP_PATH } from "@/lib/auth/paths";
import { readSignup, type SignupInput } from "@/lib/auth/signup";
import type { Categoria } from "@/lib/db/types";
import { privacyHref } from "@/lib/navigation/safe-return-path";
import { SignupBoardPreview } from "./signup-board-preview";
import {
  clearSignupDraft,
  EMPTY_DRAFT,
  readSignupDraft,
  saveSignupDraft,
} from "./signup-draft";
import { submitSignup, type SubmitSignup } from "./submit-signup";
import { useIsClient, useOnlineStatus } from "./use-online-status";

export const NETWORK_ERROR_MESSAGE =
  "Connessione non riuscita. I dati inseriti sono ancora qui: riprova.";

export const OFFLINE_MESSAGE =
  "Sei offline. I dati inseriti restano qui: potrai inviarli quando torna la connessione.";

const linkClass =
  "font-semibold underline decoration-1 underline-offset-4 focus-ring hover:decoration-2";

type Status = "idle" | "loading" | "done";

export type SignupFormProps = {
  /** Where to go once signed in (already checked with signupReturnPath). */
  returnTo?: string;
  /** Sends the form; defaults to `POST /api/auth/register`. */
  submit?: SubmitSignup;
  /** Starting values (stories, tests); otherwise the saved draft. */
  initialValues?: Partial<SignupInput>;
  /** Starting field errors (stories). */
  initialErrors?: FieldErrors;
  /** Starting form-level error (stories): the network failure message. */
  initialFormError?: string;
  /** Shows the submit in flight (stories). */
  initialLoading?: boolean;
  /** Forces the offline state (stories, tests). */
  offline?: boolean;
};

/**
 * «Registrati» (w-signup). Values are kept through loading, network errors,
 * going offline and a trip to the privacy notice (session draft, never the
 * password). Errors render next to each field and focus moves to the first.
 */
export function SignupForm(props: SignupFormProps) {
  // The draft lives in sessionStorage, which the server can't read: render
  // empty for SSR and hydration, then remount once with the draft.
  const isClient = useIsClient();
  return (
    <SignupFormInner
      key={isClient ? "client" : "ssr"}
      restore={isClient}
      {...props}
    />
  );
}

function SignupFormInner({
  restore,
  returnTo = "/",
  submit = submitSignup,
  initialValues,
  initialErrors = {},
  initialFormError,
  initialLoading = false,
  offline: forceOffline,
}: SignupFormProps & { restore: boolean }) {
  const router = useRouter();
  const online = useOnlineStatus(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const [values, setValues] = useState<SignupInput>(() => ({
    ...(restore ? readSignupDraft() : EMPTY_DRAFT),
    password: "",
    ...initialValues,
  }));
  const [errors, setErrors] = useState<FieldErrors>(initialErrors);
  const [formError, setFormError] = useState<string | null>(
    initialFormError ?? null,
  );
  const [status, setStatus] = useState<Status>(
    initialLoading ? "loading" : "idle",
  );
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  // Bumped on every failed submit, so focus moves even when the errors are
  // the same as last time (BLVS-03 pattern).
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    if (failedAttempts > 0 && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [failedAttempts]);

  // Remember everything but the password, for the privacy round trip.
  useEffect(() => {
    if (!restore || status === "done") return;
    const { password: _password, ...draft } = values;
    void _password;
    saveSignupDraft(draft);
  }, [restore, values, status]);

  function update<K extends keyof SignupInput>(key: K, value: SignupInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || !online) return;

    const checked = readSignup(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError(null);
      setFailedAttempts((n) => n + 1);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus("loading");
    const outcome = await submit(values);

    switch (outcome.kind) {
      case "ok":
        clearSignupDraft();
        setStatus("done");
        if (outcome.connesso) {
          router.replace(returnTo);
          router.refresh();
        } else {
          setDoneMessage(outcome.messaggio);
        }
        return;
      case "invalid":
        setStatus("idle");
        setErrors(outcome.fields);
        setFailedAttempts((n) => n + 1);
        return;
      case "error":
        setStatus("idle");
        setFormError(outcome.error);
        return;
      case "network":
        setStatus("idle");
        setFormError(NETWORK_ERROR_MESSAGE);
        return;
    }
  }

  if (status === "done" && doneMessage) {
    return (
      <p
        role="status"
        className="max-w-prose border-l-4 border-primary bg-tape-soft px-space-4 py-space-3 text-lg font-semibold"
      >
        {doneMessage}
      </p>
    );
  }

  const loading = status === "loading" || status === "done";
  const signupPath =
    returnTo === "/"
      ? SIGNUP_PATH
      : `${SIGNUP_PATH}?da=${encodeURIComponent(returnTo)}`;
  const emailError: ReactNode =
    errors.email === EMAIL_TAKEN_MESSAGE ? (
      <>
        {EMAIL_TAKEN_MESSAGE}{" "}
        <Link href={loginHref(returnTo)} className={linkClass}>
          Accedi
        </Link>
      </>
    ) : (
      errors.email
    );

  return (
    <div className="grid gap-stack-lg lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start">
      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        aria-label="Registrati"
        aria-busy={loading || undefined}
        className="flex max-w-xl min-w-0 flex-col gap-space-5"
      >
        <div className="grid gap-space-5 sm:grid-cols-2">
          <Field label="Nome" required error={errors.nome}>
            <Input
              name="nome"
              autoComplete="given-name"
              maxLength={100}
              value={values.nome}
              onChange={(e) => update("nome", e.currentTarget.value)}
            />
          </Field>
          <Field label="Cognome" required error={errors.cognome}>
            <Input
              name="cognome"
              autoComplete="family-name"
              maxLength={100}
              value={values.cognome}
              onChange={(e) => update("cognome", e.currentTarget.value)}
            />
          </Field>
        </div>

        <Field label="Email" required error={emailError}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={values.email}
            onChange={(e) => update("email", e.currentTarget.value)}
          />
        </Field>

        <Field
          label="Password"
          required
          hint={`Almeno ${MIN_PASSWORD_LENGTH} caratteri. Puoi incollarla dal tuo gestore di password.`}
          error={errors.password}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            maxLength={72}
            value={values.password}
            onChange={(e) => update("password", e.currentTarget.value)}
          />
        </Field>

        <RadioCardGroup
          legend="Categoria"
          name="categoria"
          required
          hint="Decide su quale tabellone giochi."
          error={errors.categoria}
          value={values.categoria || null}
          onValueChange={(value) => update("categoria", value as Categoria)}
        >
          <RadioCard value="M" title="Maschile" description="Tabellone M" />
          <RadioCard value="F" title="Femminile" description="Tabellone F" />
        </RadioCardGroup>

        <Fieldset
          legend="Informativa privacy"
          required
          hint={
            <>
              Leggi l&apos;
              <Link href={privacyHref(signupPath)} className={linkClass}>
                informativa privacy
              </Link>
              : spiega quali dati usiamo e cosa compare sul tabellone. I dati
              inseriti qui restano al tuo ritorno.
            </>
          }
          error={errors.consensoPrivacy}
        >
          <Checkbox
            name="consensoPrivacy"
            label="Ho letto l'informativa privacy e acconsento al trattamento dei miei dati"
            checked={values.consensoPrivacy}
            onCheckedChange={(checked) => update("consensoPrivacy", checked)}
          />
        </Fieldset>

        {!online && (
          <p
            role="status"
            className="flex items-start gap-space-2 border-l-4 border-warning-fg bg-warning-bg px-space-4 py-space-3 text-warning-fg"
          >
            <WifiOffIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <span>{OFFLINE_MESSAGE}</span>
          </p>
        )}

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-space-2 border-l-4 border-error-fg bg-error-bg px-space-4 py-space-3 text-error-fg"
          >
            <AlertCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
            <p className="font-semibold">{formError}</p>
          </div>
        )}

        <div className="flex flex-wrap items-start gap-space-3">
          <Button
            type="submit"
            loading={loading}
            disabled={!online}
            disabledReason="Serve la connessione per creare l'account."
          >
            {formError ? "Riprova" : "Crea account"}
          </Button>
        </div>

        <p className="text-base">
          Hai già un account?{" "}
          <Link href={loginHref(returnTo)} className={linkClass}>
            Accedi
          </Link>
        </p>
      </form>

      <SignupBoardPreview
        nome={values.nome}
        cognome={values.cognome}
        categoria={values.categoria}
        className="lg:sticky lg:top-[calc(var(--app-topbar-h,0px)+var(--spacing-space-5))]"
      />
    </div>
  );
}
