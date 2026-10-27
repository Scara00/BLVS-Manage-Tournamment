"use client";

import { useState, type ReactNode } from "react";
import { ActionLink } from "@/components/error-page/action-link";
import { ErrorBoard } from "@/components/error-page/error-board";
import { ScoreboardRows } from "@/components/error-page/scoreboard-rows";
import {
  AFTER_CONFIRMATION_PATH,
  CONFIRMATION_LINK_TTL_SECONDS,
  NO_PENDING_VERIFICATION_MESSAGE,
  type EmailVerifyStatus,
} from "@/lib/auth/email-verification/constants";
import {
  formatExpiry,
  formatValidity,
} from "@/lib/auth/email-verification/format";
import { cn } from "@/lib/utils";
import { EmailPreview } from "./email-preview";
import { RegistrationSteps } from "./registration-steps";
import { ResendPanel } from "./resend-panel";

export type EmailVerifyScreenProps = {
  status: EmailVerifyStatus;
  /** Address the link was sent to, when known. */
  email?: string;
  /** ISO time the current link expires. */
  expiresAt?: string;
  /** Seconds left before «Reinvia» unlocks. */
  waitSeconds?: number;
  className?: string;
};

/**
 * w-email-verify: step 2 of 3 of the registration. Every state of the
 * screen (Storybook shows each): loading, waiting for the click, confirmed,
 * link expired or already used (sessionExpired), nobody to confirm
 * (permissionDenied).
 */
export function EmailVerifyScreen({
  status,
  email,
  expiresAt,
  waitSeconds = 0,
  className,
}: EmailVerifyScreenProps) {
  const [expiry, setExpiry] = useState(expiresAt);

  if (status === "permissionDenied") {
    return (
      <ErrorBoard
        code={403}
        title="Accesso negato"
        className={className}
        actions={
          <>
            <ActionLink href="/registrati" variant="primary">
              Registrati
            </ActionLink>
            <ActionLink href="/accesso">Accedi</ActionLink>
          </>
        }
      >
        <p>
          {NO_PENDING_VERIFICATION_MESSAGE} Registrati per ricevere il link di
          conferma, oppure accedi se hai già confermato l&apos;indirizzo.
        </p>
      </ErrorBoard>
    );
  }

  if (status === "loading") {
    return (
      <Frame step={2} title="Conferma email" className={className}>
        <div aria-busy="true" className="flex flex-col gap-space-3">
          <p role="status" className="text-foreground">
            Caricamento…
          </p>
          <div aria-hidden="true" className="h-12 w-full max-w-md bg-muted" />
          <div aria-hidden="true" className="h-12 w-full max-w-md bg-muted" />
        </div>
      </Frame>
    );
  }

  if (status === "success") {
    return (
      <Frame step={3} title="Email confermata" className={className}>
        <p className="max-w-prose text-lg">
          {email ? (
            <>
              L&apos;indirizzo <Address>{email}</Address> è confermato.{" "}
            </>
          ) : (
            "Il tuo indirizzo è confermato. "
          )}
          Ora puoi iscriverti alle tappe del circuito.
        </p>
        <ActionLink
          href={AFTER_CONFIRMATION_PATH}
          variant="primary"
          className="self-start"
        >
          Continua: scegli la prima tappa
        </ActionLink>
      </Frame>
    );
  }

  if (status === "sessionExpired") {
    return (
      <Frame step={2} title="Link scaduto o già usato" className={className}>
        <p className="max-w-prose text-lg">
          Questo link di conferma non è più valido: è scaduto, è già stato usato
          oppure ne hai chiesto uno più recente. Chiedine uno nuovo
          {email ? (
            <>
              {" "}
              per <Address>{email}</Address>
            </>
          ) : null}
          : vale {formatValidity()}.
        </p>
        <ResendPanel
          email={email}
          initialWaitSeconds={waitSeconds}
          label="Invia un nuovo link"
          onSent={(answer) => setExpiry(answer.scadeIl)}
        />
      </Frame>
    );
  }

  return (
    <Frame step={2} title="Controlla la tua email" className={className}>
      <p className="max-w-prose text-lg">
        Ti abbiamo inviato un link di conferma
        {email ? (
          <>
            {" "}
            a <Address>{email}</Address>
          </>
        ) : null}
        . Aprilo per confermare l&apos;indirizzo: serve prima della tua prima
        iscrizione a una tappa.
      </p>
      <ScoreboardRows
        label="Scadenza del link"
        rows={[
          {
            label: "Valido per",
            value: formatValidity(CONFIRMATION_LINK_TTL_SECONDS),
          },
          ...(expiry
            ? [
                {
                  label: "Scade alle",
                  value: formatExpiry(new Date(expiry)),
                  tone: "tape" as const,
                },
              ]
            : []),
        ]}
      />
      <section
        aria-labelledby="email-verify-resend"
        className="flex flex-col gap-space-3"
      >
        <h2
          id="email-verify-resend"
          className="font-heading text-xl font-semibold"
        >
          Non è arrivata?
        </h2>
        <p className="max-w-prose">
          Controlla anche la cartella spam. Se chiedi un nuovo link, quello
          precedente smette di funzionare.
        </p>
        <ResendPanel
          email={email}
          initialWaitSeconds={waitSeconds}
          onSent={(answer) => setExpiry(answer.scadeIl)}
        />
      </section>
      <EmailPreview email={email} className="max-w-xl" />
    </Frame>
  );
}

function Frame({
  step,
  title,
  className,
  children,
}: {
  step: number;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      data-slot="email-verify"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-stack-lg px-inset py-space-6 md:px-inset-lg md:py-space-8",
        className,
      )}
    >
      <RegistrationSteps current={step} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        {title}
      </h1>
      {children}
    </div>
  );
}

/** The address in mono, wrapping anywhere so long ones never overflow. */
function Address({ children }: { children: ReactNode }) {
  return <span className="font-mono font-semibold break-all">{children}</span>;
}
