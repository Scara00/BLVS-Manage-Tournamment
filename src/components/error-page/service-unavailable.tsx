"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatServerTime } from "@/lib/time/server-time";
import { ActionLink } from "./action-link";
import { ErrorBoard } from "./error-board";
import { ScoreboardRows } from "./scoreboard-rows";

/** Fixed target of «Torna al modulo»: stage registration lives under the stages. */
export const DEFAULT_FORM_HREF = "/tappe";

export type ServiceUnavailableProps = {
  /** What did not start, e.g. «L'iscrizione alla tappa». */
  what: string;
  /** Error code shown to quote to support, e.g. `ERR-503-ISCR`. */
  code: string;
  /** When it failed. */
  at: Date;
  /** Retries the failed operation. */
  onRetry: () => void | Promise<void>;
  /** Forces the loading state of «Riprova» (e.g. a parent-driven retry). */
  retrying?: boolean;
  formHref?: string;
  homeHref?: string;
  documentTitle?: string;
};

/** 503: what did not start, with code, time and the three ways out. */
export function ServiceUnavailable({
  what,
  code,
  at,
  onRetry,
  retrying = false,
  formHref = DEFAULT_FORM_HREF,
  homeHref = "/",
  documentTitle,
}: ServiceUnavailableProps) {
  const [pending, startTransition] = useTransition();

  return (
    <ErrorBoard
      code={503}
      title="Servizio non disponibile"
      documentTitle={documentTitle}
      board={
        <ScoreboardRows
          label="Dettagli dell'errore"
          rows={[
            { label: "Non è partito", value: what, tone: "tape" },
            { label: "Codice", value: code },
            {
              label: "Orario",
              value: (
                // Client and server clocks differ by the render delay.
                <time dateTime={at.toISOString()} suppressHydrationWarning>
                  {formatServerTime(at)}
                </time>
              ),
            },
          ]}
        />
      }
      actions={
        <>
          <Button
            loading={retrying || pending}
            onClick={() => startTransition(() => onRetry())}
          >
            Riprova
          </Button>
          <ActionLink href={formHref}>Torna al modulo</ActionLink>
          <ActionLink href={homeHref}>Home</ActionLink>
        </>
      }
    >
      <p>
        Il servizio non ha risposto, quindi l&apos;operazione non è stata
        eseguita e non abbiamo salvato nulla. Riprova tra qualche istante; se
        l&apos;errore resta, comunica il codice e l&apos;orario allo staff del
        torneo.
      </p>
    </ErrorBoard>
  );
}
