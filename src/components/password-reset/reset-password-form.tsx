"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { FieldErrors } from "@/lib/api/responses";
import { checkPassword, newPasswordErrors } from "@/lib/auth/password-policy";
import {
  NETWORK_MESSAGE,
  OFFLINE_MESSAGE,
  postJson,
  type PostOutcome,
} from "@/lib/auth/password-reset/client";
import type { FormStatus } from "./forgot-password-form";
import { FormAlert, PasswordFrame } from "./password-frame";
import { PasswordRequirements } from "./password-requirements";
import { ResetLinkInvalid } from "./reset-link-invalid";

export const OTHER_SESSIONS_NOTE =
  "Salvando, chiudiamo le sessioni aperte sugli altri dispositivi. Su questo resti connesso.";

export type ResetPasswordFormViewProps = {
  status: FormStatus | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Bumped on every failed submit: moves focus to the first error. */
  failedAttempts?: number;
  defaultPassword?: string;
  defaultConfirmation?: string;
  onSubmit?: (password: string, confirmation: string) => void;
};

/** w-reset: new password twice, with the live ✓/✕ requirements. */
export function ResetPasswordFormView({
  status,
  message,
  fieldErrors = {},
  failedAttempts = 0,
  defaultPassword = "",
  defaultConfirmation = "",
  onSubmit,
}: ResetPasswordFormViewProps) {
  const ids = useId();
  const requirementsId = `${ids}-requisiti`;
  const noteId = `${ids}-sessioni`;
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState(defaultPassword);
  const [confirmation, setConfirmation] = useState(defaultConfirmation);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (failedAttempts > 0 && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [failedAttempts]);

  if (status === "success") {
    return (
      <PasswordFrame title="Password aggiornata" focusHeading>
        <p
          role="status"
          className="flex items-start gap-space-2 border-l-4 border-success-fg bg-success-bg px-space-4 py-space-3 text-success-fg"
        >
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            {message ??
              "La nuova password è salva e le altre sessioni sono chiuse."}{" "}
            Ti stiamo portando alla home.
          </span>
        </p>
        <div>
          <Link
            href="/"
            className="font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
          >
            Vai alla home
          </Link>
        </div>
      </PasswordFrame>
    );
  }

  const alert =
    status === "offline"
      ? OFFLINE_MESSAGE
      : status === "network"
        ? NETWORK_MESSAGE
        : status === "error"
          ? message
          : undefined;

  return (
    <PasswordFrame
      title="Scegli una nuova password"
      description={<p>La userai da ora in poi per accedere a BLVS.</p>}
    >
      <form
        ref={formRef}
        noValidate
        aria-label="Modulo per la nuova password"
        className="flex flex-col gap-space-5"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit?.(password, confirmation);
        }}
      >
        <Field label="Nuova password" required error={fieldErrors.password}>
          <Input
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            spellCheck={false}
            aria-describedby={requirementsId}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
        </Field>
        <Field
          label="Ripeti la nuova password"
          required
          error={fieldErrors.conferma}
        >
          <Input
            name="conferma"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            spellCheck={false}
            value={confirmation}
            onChange={(e) => setConfirmation(e.currentTarget.value)}
          />
        </Field>
        <div>
          <Button
            type="button"
            variant="link"
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            Mostra le password
          </Button>
        </div>
        <PasswordRequirements
          id={requirementsId}
          results={checkPassword(password, confirmation)}
        />
        {alert ? <FormAlert>{alert}</FormAlert> : null}
        <div className="flex flex-col items-start gap-space-2">
          <Button
            type="submit"
            loading={status === "loading"}
            aria-describedby={noteId}
          >
            Salva la nuova password
          </Button>
          <p id={noteId} className="max-w-prose text-sm text-muted-foreground">
            {OTHER_SESSIONS_NOTE}
          </p>
        </div>
      </form>
    </PasswordFrame>
  );
}

type SaveResult = PostOutcome<{
  messaggio: string;
  altreSessioniChiuse: boolean;
}>;

export type SaveNewPassword = (input: {
  tokenHash?: string;
  password: string;
  conferma: string;
}) => Promise<SaveResult>;

export function saveNewPassword(input: Parameters<SaveNewPassword>[0]) {
  return postJson<{ messaggio: string; altreSessioniChiuse: boolean }>(
    "/api/auth/password/reimposta",
    input,
  );
}

type FlowState = {
  view: "form" | "invalid";
  status: FormStatus | "success";
  message?: string;
  fieldErrors: FieldErrors;
  failedAttempts: number;
  /** false once the token is spent and this device holds the recovery session. */
  useToken: boolean;
};

/**
 * w-reset. The token is spent only on «Salva» (not on page load), so link
 * scanners cannot burn it; a dead link shows `ResetLinkInvalid`. On success
 * this device stays signed in: a toast confirms and the user goes home.
 */
export function ResetPasswordFlow({
  tokenHash,
  save = saveNewPassword,
}: {
  tokenHash: string | null;
  save?: SaveNewPassword;
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<FlowState>({
    view: tokenHash ? "form" : "invalid",
    status: "idle",
    fieldErrors: {},
    failedAttempts: 0,
    useToken: true,
  });

  if (state.view === "invalid") {
    return <ResetLinkInvalid focusHeading={state.failedAttempts > 0} />;
  }

  async function submit(password: string, conferma: string) {
    if (state.status === "loading" || state.status === "success") return;
    const local = newPasswordErrors(password, conferma);
    if (Object.keys(local).length > 0) {
      setState((s) => ({
        ...s,
        status: "idle",
        fieldErrors: local,
        failedAttempts: s.failedAttempts + 1,
      }));
      return;
    }
    setState((s) => ({ ...s, status: "loading", fieldErrors: {} }));
    const outcome = await save({
      tokenHash: state.useToken ? (tokenHash ?? undefined) : undefined,
      password,
      conferma,
    });
    if (outcome.kind === "ok") {
      setState((s) => ({
        ...s,
        status: "success",
        message: outcome.data.messaggio,
      }));
      toast.add({
        title: "Password aggiornata",
        description: outcome.data.messaggio,
      });
      router.replace("/");
      return;
    }
    setState((s) => {
      const useToken =
        "body" in outcome && outcome.body.sessioneRecupero ? false : s.useToken;
      switch (outcome.kind) {
        case "link-invalid":
          return {
            ...s,
            view: "invalid",
            failedAttempts: s.failedAttempts + 1,
          };
        case "fields":
          return {
            ...s,
            useToken,
            status: "idle",
            fieldErrors: outcome.fields,
            failedAttempts: s.failedAttempts + 1,
          };
        case "offline":
        case "network":
          return { ...s, status: outcome.kind };
        default:
          return { ...s, useToken, status: "error", message: outcome.message };
      }
    });
  }

  return (
    <ResetPasswordFormView
      status={state.status}
      message={state.message}
      fieldErrors={state.fieldErrors}
      failedAttempts={state.failedAttempts}
      onSubmit={submit}
    />
  );
}
