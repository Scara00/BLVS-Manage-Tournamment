"use client";

import { AlertCircleIcon, ArrowLeftIcon, PlayIcon } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { CATEGORIE } from "@/lib/db/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { contaLabel, type AvvioFaseView } from "@/lib/tappe/avvio/format";
import {
  avvioFasePath,
  CATEGORIA_NOME,
  CATEGORIA_SEGMENTO,
} from "@/lib/tappe/avvio/paths";
import {
  AVVIO_MESSAGES,
  initialAvvioFaseState,
  type AvvioFaseAction,
  type AvvioFaseState,
} from "@/lib/tappe/avvio/state";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import { AnteprimaPartite } from "./anteprima-partite";
import { ControlliAvvio } from "./controlli-avvio";
import { ErroriAvvio } from "./errori-avvio";
import { RiepilogoAvvio } from "./riepilogo-avvio";

type AvvioFaseProps = {
  view: AvvioFaseView;
  /** The `avviaFase` server action (a fake in Storybook). */
  action: AvvioFaseAction;
  /** Storybook/axe: open the confirmation, force offline, starting state. */
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: AvvioFaseState;
};

function focusOn(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: "nearest" });
}

/** M/F switch: each board starts on its own. */
function SceltaTabellone({ view }: { view: AvvioFaseView }) {
  return (
    <nav aria-label="Tabellone" className="flex flex-wrap gap-space-2">
      {CATEGORIE.map((c) => {
        const attuale = c === view.categoria;
        return (
          <Link
            key={c}
            href={avvioFasePath(view.tappa.id, c)}
            aria-current={attuale ? "page" : undefined}
            className={buttonVariants({
              variant: attuale ? "primary" : "secondary",
              className: "max-w-full",
            })}
          >
            Tabellone {CATEGORIA_NOME[c]}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * w-admin-avvio-fase: for one board, the summary of groups, players and
 * matches, the three blocking checks, the errors with a link to each group
 * and the preview of the matches. «Avvia» creates the matches «da
 * giocare», moves the stage to «in corso» and tells the live pages; the
 * server repeats every check and refuses with the list of errors.
 */
export function AvvioFase({
  view,
  action,
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialAvvioFaseState,
}: AvvioFaseProps) {
  const [open, setOpen] = useState(defaultOpen);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const erroriRef = useRef<HTMLHeadingElement>(null);
  const fineRef = useRef<HTMLParagraphElement>(null);
  // The dialog keeps the summary it was opened with while it fades out.
  const [nelDialog, setNelDialog] = useState(view.riepilogo);

  // A failed request rejects instead of returning a state: make it «network».
  const safeAction = useCallback<AvvioFaseAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[avvio-fase] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: AVVIO_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state.status !== "idle") setOpen(false);
  }

  // After a success the message appears with the refreshed page, which may
  // arrive after the new state: focus it as soon as it is there.
  const fuocoAllaFine = useRef(false);
  useEffect(() => {
    if (state.status === "fieldErrors") focusOn(erroriRef.current);
    if (state.status === "success") {
      toast.add({ title: state.message });
      fuocoAllaFine.current = true;
    }
  }, [state, toast]);
  useEffect(() => {
    if (fuocoAllaFine.current && fineRef.current) {
      fuocoAllaFine.current = false;
      focusOn(fineRef.current);
    }
  }, [state, view.avviata]);

  const problemi =
    state.status === "fieldErrors" ? state.errori : view.problemi;
  const errore = state.status === "error" ? state : null;
  const offlineReason = online ? null : AVVIO_MESSAGES.offline;

  const campi = (
    <>
      <input type="hidden" name="tappaId" value={view.tappa.id} />
      <input
        type="hidden"
        name="categoria"
        value={CATEGORIA_SEGMENTO[view.categoria]}
      />
    </>
  );
  const etichetta = "Avvia i gironi iniziali";

  let azione;
  if (view.avviata) {
    azione = (
      <p
        ref={fineRef}
        tabIndex={-1}
        className="self-start font-heading text-lg font-semibold focus-ring"
        data-testid="fase-avviata"
      >
        Fase «gironi iniziali» avviata: le partite sono da giocare.
      </p>
    );
  } else if (view.nonDisponibile) {
    azione = <p className="self-start">{view.nonDisponibile}</p>;
  } else if (problemi.length > 0) {
    // Known problems: no confirmation, the server answers with the list.
    azione = (
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!online || pending) event.preventDefault();
        }}
        className="flex flex-col items-start gap-space-2"
      >
        {campi}
        <Button
          type="submit"
          className="max-w-full"
          loading={pending}
          disabled={!online}
          disabledReason={offlineReason}
        >
          <PlayIcon aria-hidden />
          {etichetta}
        </Button>
      </form>
    );
  } else {
    azione = (
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) setNelDialog(view.riepilogo);
          setOpen(next);
        }}
      >
        <AlertDialogTrigger
          render={
            <Button
              className="max-w-full self-start"
              disabled={!online}
              disabledReason={offlineReason}
            />
          }
        >
          <PlayIcon aria-hidden />
          {etichetta}
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-xl">
          <form
            action={formAction}
            onSubmit={(event) => {
              if (!online || pending) event.preventDefault();
            }}
            className="contents"
          >
            {campi}
            <AlertDialogHeader>
              <AlertDialogTitle>
                Avviare i gironi iniziali del{" "}
                {view.tabelloneLabel.toLowerCase()}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Si creano {contaLabel(nelDialog.partite, "partita", "partite")}{" "}
                da giocare per{" "}
                {contaLabel(nelDialog.gironi, "girone", "gironi")} (
                {contaLabel(nelDialog.giocatori, "giocatore", "giocatori")}). La
                tappa passa a «in corso» e le pagine live mostrano le nuove
                partite. Dopo l&apos;avvio i gironi non si cambiano più da qui.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                loading={pending}
                loadingText="Avvio in corso…"
              >
                Avvia
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg" data-testid="avvio-fase">
      <section
        aria-labelledby="avvio-tappa"
        className="flex flex-col gap-stack-sm"
      >
        <div className="flex flex-col gap-space-1">
          <h2
            id="avvio-tappa"
            className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
          >
            {view.tappa.nome}
          </h2>
          <p className="font-heading font-semibold">{view.tabelloneLabel}</p>
        </div>
        <SceltaTabellone view={view} />
      </section>

      <RiepilogoAvvio riepilogo={view.riepilogo} avviata={view.avviata} />

      {view.avviata ? null : <ControlliAvvio controlli={view.controlli} />}

      {view.avviata ? null : (
        <ErroriAvvio
          tappaId={view.tappa.id}
          categoria={view.categoria}
          problemi={problemi}
          headingRef={erroriRef}
        />
      )}

      <div className="flex flex-col gap-space-2">
        <div role="alert" data-testid="avvio-annuncio">
          {state.status === "fieldErrors" ? (
            <p className="flex items-start gap-space-2 font-semibold text-error-fg">
              <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
              {state.message}{" "}
              {contaLabel(state.errori.length, "errore", "errori")}.
            </p>
          ) : null}
          {errore ? (
            <div className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg">
              <p className="flex items-start gap-space-2 font-semibold">
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore.message}
              </p>
              {errore.reason === "sessionExpired" ? (
                <Link
                  href={sessionExpiredHref(
                    avvioFasePath(view.tappa.id, view.categoria),
                  )}
                  className={buttonVariants({ variant: "primary" })}
                >
                  Accedi di nuovo
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
        {azione}
      </div>

      <AnteprimaPartite
        anteprima={view.anteprima}
        titolo={view.avviata ? "Partite create" : "Anteprima delle partite"}
      />

      <Link
        href={gestioneTappaPath(view.tappa.id)}
        className="inline-flex items-center gap-space-2 self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Torna alla tappa
      </Link>
    </div>
  );
}
