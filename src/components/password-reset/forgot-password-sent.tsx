"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  NETWORK_MESSAGE,
  OFFLINE_MESSAGE,
  type PostOutcome,
} from "@/lib/auth/password-reset/client";
import {
  LOGIN_PATH,
  RESEND_COOLDOWN_SECONDS,
  RESET_LINK_VALIDITY_MINUTES,
} from "@/lib/auth/password-reset/messages";
import type { FormStatus } from "./forgot-password-form";
import { FormAlert, PasswordFrame } from "./password-frame";
import { formatCountdown, useResendCooldown } from "./use-resend-cooldown";

export const COOLDOWN_START_ANNOUNCEMENT = `Email inviata. Potrai chiederne un'altra tra ${RESEND_COOLDOWN_SECONDS} secondi.`;
export const COOLDOWN_END_ANNOUNCEMENT =
  "Ora puoi chiedere di inviare di nuovo l'email.";

export type ForgotPasswordSentProps = {
  email: string;
  /** Sends the link again; the countdown restarts when it succeeds. */
  onResend?: () => Promise<PostOutcome<unknown>>;
  /** Back to w-forgot to type another address. */
  onChangeEmail?: () => void;
  /** Seconds «Invia di nuovo» stays blocked (0: already available). */
  cooldownSeconds?: number;
  /** Starting status of the resend (stories). */
  initialStatus?: FormStatus;
  initialMessage?: string;
  focusHeading?: boolean;
};

/**
 * w-forgot-sent: the same text whether or not the address has an account.
 * The countdown is visible and tied to the button, but only its start and
 * its end are announced (one polite status region), not every second.
 */
export function ForgotPasswordSent({
  email,
  onResend,
  onChangeEmail,
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
  initialStatus = "idle",
  initialMessage,
  focusHeading = false,
}: ForgotPasswordSentProps) {
  const cooldown = useResendCooldown(cooldownSeconds);
  const [status, setStatus] = useState<FormStatus>(initialStatus);
  const [message, setMessage] = useState(initialMessage);
  const [announcement, setAnnouncement] = useState("");
  const wasActive = useRef(false);
  const reasonId = useId();
  const { start } = cooldown;

  // Countdown from the moment the email was asked for.
  useEffect(() => {
    if (cooldownSeconds > 0) start();
  }, [cooldownSeconds, start]);

  // Announce the start and the end only. The region is rendered empty first
  // and filled a moment later, so screen readers notice the change.
  useEffect(() => {
    const active = cooldown.active;
    if (active === wasActive.current) return;
    const id = setTimeout(
      () => {
        wasActive.current = active;
        setAnnouncement(
          active ? COOLDOWN_START_ANNOUNCEMENT : COOLDOWN_END_ANNOUNCEMENT,
        );
      },
      active ? 150 : 0,
    );
    return () => clearTimeout(id);
  }, [cooldown.active]);

  async function resend() {
    if (!onResend || status === "loading" || cooldown.active) return;
    setStatus("loading");
    setAnnouncement("");
    const outcome = await onResend();
    if (outcome.kind === "ok") {
      setStatus("idle");
      start();
    } else if (outcome.kind === "offline" || outcome.kind === "network") {
      setStatus(outcome.kind);
    } else {
      setStatus("error");
      setMessage(outcome.message);
    }
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
      title="Controlla la tua email"
      focusHeading={focusHeading}
      description={
        <>
          <p>
            Se <strong className="break-all">{email}</strong> è registrato,
            riceverai un&apos;email con il link per scegliere una nuova
            password.
          </p>
          <p className="text-base">
            Il link vale {RESET_LINK_VALIDITY_MINUTES} minuti e si può usare una
            sola volta. Non la trovi? Guarda anche nella posta indesiderata.
          </p>
        </>
      }
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {alert ? <FormAlert>{alert}</FormAlert> : null}
      <div className="flex flex-col items-start gap-space-4">
        {/* Not Button's `disabledReason`: that swaps the markup when the
            countdown ends and a focused button would lose focus. */}
        <div className="flex flex-col items-start gap-space-1">
          <Button
            type="button"
            variant="secondary"
            loading={status === "loading"}
            disabled={cooldown.active}
            focusableWhenDisabled
            aria-describedby={cooldown.active ? reasonId : undefined}
            onClick={resend}
          >
            Invia di nuovo
          </Button>
          {cooldown.active ? (
            <p id={reasonId} className="text-sm text-muted-foreground">
              Puoi chiedere un nuovo invio tra{" "}
              <span className="font-mono">
                {formatCountdown(cooldown.remaining)}
              </span>
              .
            </p>
          ) : null}
        </div>
        <Button type="button" variant="link" onClick={onChangeEmail}>
          Usa un altro indirizzo
        </Button>
        <Link
          href={LOGIN_PATH}
          className="inline-flex min-h-6 items-center font-heading font-semibold text-primary underline decoration-2 underline-offset-4 focus-ring hover:decoration-4"
        >
          Torna all&apos;accesso
        </Link>
      </div>
    </PasswordFrame>
  );
}
