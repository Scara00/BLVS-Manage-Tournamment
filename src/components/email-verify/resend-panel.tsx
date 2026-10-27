"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  EMAIL_RESEND_API,
  RESEND_FAILED_MESSAGE,
  type ResendError,
  type ResendResponse,
} from "@/lib/auth/email-verification/constants";
import { formatCountdown } from "@/lib/auth/email-verification/format";
import { now } from "@/lib/time/server-time";

export const RESENT_MESSAGE =
  "Ti abbiamo inviato un nuovo link. Quello precedente non funziona più.";

export const RESEND_READY_MESSAGE = "Puoi chiedere un nuovo link.";

type Message = { kind: "status" | "alert"; text: string };

/**
 * «Reinvia email» with the 60 s lock. The server decides (429 with
 * `attesaSecondi`); the countdown only mirrors it. While locked the button
 * stays focusable (same DOM node, so focus survives the lock) and says
 * why, with the time left in digits. Screen
 * readers hear one message when a link is sent and one when the lock ends,
 * never every second.
 */
export function ResendPanel({
  email,
  initialWaitSeconds = 0,
  label = "Reinvia email",
  onSent,
}: {
  /** Known address; without it the panel asks for one. */
  email?: string;
  /** Seconds left on the lock when the page was rendered. */
  initialWaitSeconds?: number;
  label?: string;
  onSent?: (answer: ResendResponse) => void;
}) {
  // Each lock restarts the countdown, even with the same number of seconds.
  const [lockRun, setLockRun] = useState({
    seconds: Math.max(0, initialWaitSeconds),
    run: 0,
  });
  const [remaining, setRemaining] = useState(lockRun.seconds);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const reasonId = useId();

  // The deadline is computed on the client only, so SSR and hydration agree.
  useEffect(() => {
    if (lockRun.seconds <= 0) return;
    const deadline = now().getTime() + lockRun.seconds * 1000;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - now().getTime()) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        setMessage((current) =>
          current?.kind === "alert"
            ? current
            : { kind: "status", text: RESEND_READY_MESSAGE },
        );
      }
    }, 250);
    return () => clearInterval(timer);
  }, [lockRun]);

  useEffect(() => {
    if (failedAttempts > 0 && formRef.current)
      focusFirstInvalid(formRef.current);
  }, [failedAttempts]);

  function lock(seconds: number) {
    setRemaining(seconds);
    setLockRun((current) => ({ seconds, run: current.run + 1 }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || remaining > 0) return;
    const typed = email
      ? undefined
      : String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email && !typed) {
      setEmailError("Inserisci l'indirizzo email con cui ti sei registrato.");
      setFailedAttempts((n) => n + 1);
      return;
    }
    setEmailError(null);
    setMessage(null);
    setPending(true);
    try {
      const response = await fetch(EMAIL_RESEND_API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(typed ? { email: typed } : {}),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<
        ResendResponse & ResendError & { fields: Record<string, string> }
      >;
      if (response.ok && typeof body.attesaSecondi === "number") {
        lock(body.attesaSecondi);
        setMessage({ kind: "status", text: RESENT_MESSAGE });
        onSent?.(body as ResendResponse);
      } else if (response.status === 429) {
        lock(body.attesaSecondi ?? 60);
        setMessage({
          kind: "alert",
          text: body.error ?? RESEND_FAILED_MESSAGE,
        });
      } else if (response.status === 422 && body.fields?.email) {
        setEmailError(body.fields.email);
        setFailedAttempts((n) => n + 1);
      } else {
        setMessage({
          kind: "alert",
          text: body.error ?? RESEND_FAILED_MESSAGE,
        });
      }
    } catch {
      setMessage({ kind: "alert", text: RESEND_FAILED_MESSAGE });
    } finally {
      setPending(false);
    }
  }

  const locked = remaining > 0;
  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      data-slot="resend-panel"
      className="flex flex-col gap-space-3"
    >
      {email ? null : (
        <Field label="Email" required error={emailError ?? undefined}>
          <Input name="email" type="email" autoComplete="email" />
        </Field>
      )}
      {/* The reason is rendered here, not through Button's disabledReason:
          that wraps the button in a new element when it appears, which
          remounts it and drops keyboard focus when the lock starts or ends. */}
      <div className="flex flex-col items-start gap-space-1">
        <Button
          type="submit"
          loading={pending}
          disabled={locked}
          focusableWhenDisabled
          aria-describedby={locked ? reasonId : undefined}
        >
          {label}
        </Button>
        {locked ? (
          <p id={reasonId} className="text-sm text-muted-foreground">
            Puoi chiedere un nuovo link tra{" "}
            <span className="font-mono tabular-nums">
              {formatCountdown(remaining)}
            </span>
            .
          </p>
        ) : null}
      </div>
      <p role="status" className="min-h-6 text-foreground">
        {message?.kind === "status" ? message.text : null}
      </p>
      {message?.kind === "alert" ? (
        <p role="alert" className="font-semibold text-error-fg">
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
