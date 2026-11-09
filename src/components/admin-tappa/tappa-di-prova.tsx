"use client";

import { AlertCircleIcon, FlaskConicalIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useId } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import type { StatoTappa } from "@/lib/db/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  classificaTappaHref,
  liveTappaHref,
  tabelloneTappaHref,
  tappaHref,
} from "@/lib/tappe/paths";
import {
  GESTIONE_MESSAGES,
  gestioneTappaPath,
  initialProvaState,
  type ProvaAction,
  type ProvaState,
} from "@/lib/tappe/gestione-state";

type TappaDiProvaProps = {
  tappaId: string;
  stato: StatoTappa;
  /** `tappe.prova`. */
  prova: boolean;
  /** The `impostaTappaProva` server action (a fake in Storybook). */
  action: ProvaAction;
  offline?: boolean;
  initialState?: ProvaState;
};

/**
 * «Tappa di prova»: a draft the admin plays end to end (groups, scores,
 * phases, finals) to try the app on a real case, without publishing it.
 * It is offered on a draft, and can always be switched off.
 */
export function TappaDiProva({
  tappaId,
  stato,
  prova,
  action,
  offline: forceOffline,
  initialState = initialProvaState,
}: TappaDiProvaProps) {
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const titoloId = useId();
  const offlineId = useId();

  const safeAction = useCallback<ProvaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[tappe] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: GESTIONE_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  useEffect(() => {
    if (state.status === "success") toast.add({ title: state.message });
  }, [state, toast]);

  if (stato !== "bozza" && !prova) return null;
  const attiva = prova && stato === "bozza";
  const errore = state.status === "error" ? state : null;

  return (
    <section
      aria-labelledby={titoloId}
      data-testid="tappa-di-prova"
      className="flex max-w-prose flex-col gap-stack-sm border-2 border-dashed border-primary p-inset"
    >
      <h2
        id={titoloId}
        className="flex items-center gap-space-2 font-heading text-xl font-semibold"
      >
        <FlaskConicalIcon aria-hidden className="size-5 shrink-0" />
        Tappa di prova
      </h2>
      <p>
        Per provare l&apos;app su un caso reale senza pubblicare la tappa:
        gironi, punteggi, fasi e finali funzionano anche in bozza. Resta una
        bozza: i giocatori non la vedono e non entra nella classifica generale.
        Tu ne vedi anche le pagine giocatore.
      </p>
      <p className="font-semibold" data-testid="tappa-di-prova-stato">
        {attiva
          ? "Attiva."
          : prova
            ? "Attiva, ma la tappa non è più una bozza: non ha effetto."
            : "Spenta."}
      </p>
      {attiva ? (
        <nav aria-label="Pagine giocatore della tappa di prova">
          <ul className="flex flex-wrap gap-space-2">
            {[
              { href: tappaHref(tappaId), label: "Dettaglio" },
              { href: liveTappaHref(tappaId), label: "Live" },
              { href: tabelloneTappaHref(tappaId), label: "Gironi e fasi" },
              { href: classificaTappaHref(tappaId), label: "Classifica" },
            ].map((pagina) => (
              <li key={pagina.href}>
                <Link
                  href={pagina.href}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {pagina.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!online || pending) event.preventDefault();
        }}
        className="flex flex-col items-start gap-space-3"
      >
        <input type="hidden" name="tappaId" value={tappaId} />
        <input type="hidden" name="prova" value={prova ? "false" : "true"} />
        {errore ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
          >
            <p className="flex items-start gap-space-2 font-semibold">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {errore.message}
            </p>
            {errore.reason === "sessionExpired" ? (
              <Link
                href={sessionExpiredHref(gestioneTappaPath(tappaId))}
                className={buttonVariants({ variant: "primary" })}
              >
                Accedi di nuovo
              </Link>
            ) : null}
          </div>
        ) : null}
        {!online ? (
          <p
            id={offlineId}
            className="flex items-start gap-space-2 font-medium"
          >
            <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
            {GESTIONE_MESSAGES.offline}
          </p>
        ) : null}
        <Button
          type="submit"
          variant={prova ? "secondary" : "primary"}
          loading={pending}
          disabled={!online}
          focusableWhenDisabled
          aria-describedby={!online ? offlineId : undefined}
          className="max-w-full"
        >
          {prova ? "Spegni la tappa di prova" : "Attiva la tappa di prova"}
        </Button>
      </form>
    </section>
  );
}
