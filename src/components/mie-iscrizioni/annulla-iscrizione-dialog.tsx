"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ANNULLA_MESSAGES } from "@/lib/iscrizioni/annullamento/errori";
import {
  ANNULLA_ISCRIZIONE_INITIAL,
  type AnnullaIscrizioneAction,
  type AnnullaIscrizioneState,
} from "@/lib/iscrizioni/annullamento/state";
import type { AnnullamentoView } from "@/lib/iscrizioni/annullamento/view";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";

export type EsitoDialog = { annullata: boolean; message?: string };

type AnnullaIscrizioneDialogProps = {
  /** `null` when closed. */
  target: AnnullamentoView | null;
  onClose: (esito: EsitoDialog) => void;
  /** The button that opened it: focus returns there on «Mantieni». */
  returnFocus: React.RefObject<HTMLElement | null>;
  /** Where focus goes after a cancel (the button is gone by then). */
  esitoId: string;
  /** The page, to come back to after signing in again. */
  ritorno: string;
  /** The `annullaIscrizione` server action (a fake in Storybook). */
  action: AnnullaIscrizioneAction;
  initialState?: AnnullaIscrizioneState;
};

/**
 * w-annulla-iscrizione: the confirmation before cancelling a registration.
 * One dialog per page, opened by «Annulla l'iscrizione». Focus starts on
 * «Mantieni l'iscrizione», the safe choice; Esc and «Mantieni» change
 * nothing and give focus back to the button. The consequences are listed
 * as text. After a cancel focus lands on the page's result message.
 */
export function AnnullaIscrizioneDialog({
  target,
  onClose,
  returnFocus,
  esitoId,
  ritorno,
  action,
  initialState = ANNULLA_ISCRIZIONE_INITIAL,
}: AnnullaIscrizioneDialogProps) {
  const toast = useToast();
  // The content stays on the registration it was opened for while it fades.
  const [mostrato, setMostrato] = useState(target);
  const annullata = useRef(false);
  const gestito = useRef<AnnullaIscrizioneState | null>(null);

  const safeAction = useCallback<AnnullaIscrizioneAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[iscrizioni] annullamento non riuscito", error);
        return {
          status: "error",
          reason: "network",
          message: ANNULLA_MESSAGES.network,
          attempt: prev.status === "idle" ? 1 : prev.attempt + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "error") setMostraErrore(true);
  }
  if (target && target !== mostrato) {
    setMostrato(target);
    setMostraErrore(false);
  }

  useEffect(() => {
    if (state.status !== "success" || gestito.current === state) return;
    gestito.current = state;
    annullata.current = true;
    toast.add({ title: state.message });
    onClose({ annullata: true, message: state.message });
  }, [state, toast, onClose]);

  const dati = target ?? mostrato;
  const errore = state.status === "error" && mostraErrore ? state : null;

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (pending || next) return;
        onClose({ annullata: false });
      }}
    >
      <AlertDialogContent
        className="max-w-lg"
        data-testid="annulla-iscrizione-dialog"
        finalFocus={() => {
          const dopo = annullata.current;
          annullata.current = false;
          if (dopo) return document.getElementById(esitoId) ?? true;
          return returnFocus.current ?? true;
        }}
      >
        {dati ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              const formData = new FormData(event.currentTarget);
              startTransition(() => formAction(formData));
            }}
            className="contents"
          >
            <input
              type="hidden"
              name="iscrizioneId"
              value={dati.iscrizioneId}
            />
            <input type="hidden" name="tappaId" value={dati.tappaId} />
            <input type="hidden" name="tappa" value={dati.tappa} />
            <AlertDialogHeader>
              <AlertDialogTitle>
                Annullare l&apos;iscrizione a {dati.tappa}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dati.posto ? (
                  <>
                    Hai il posto{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {dati.posto}
                    </span>{" "}
                    nel tabellone{" "}
                    {CATEGORIA_LABEL[dati.categoria].toLowerCase()}.
                  </>
                ) : (
                  <>
                    Sei iscritto nel tabellone{" "}
                    {CATEGORIA_LABEL[dati.categoria].toLowerCase()}.
                  </>
                )}{" "}
                {dati.scadenza && dati.scadenzaIso ? (
                  <>
                    Puoi annullare fino al{" "}
                    <time
                      dateTime={dati.scadenzaIso}
                      className="font-mono tabular-nums"
                    >
                      {dati.scadenza}
                    </time>
                    .
                  </>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody className="flex flex-col gap-space-3">
              <h3 className="font-heading font-semibold">
                Cosa succede se annulli
              </h3>
              <ul
                data-testid="annulla-conseguenze"
                className="flex list-disc flex-col gap-space-2 pl-space-5"
              >
                {dati.conseguenze.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              {errore ? (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
                >
                  <p className="flex items-start gap-space-2 font-semibold">
                    <AlertCircleIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0"
                    />
                    {errore.message}
                  </p>
                  {errore.reason === "sessionExpired" ? (
                    <Link
                      href={sessionExpiredHref(ritorno)}
                      className={buttonVariants({ variant: "primary" })}
                    >
                      Accedi di nuovo
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Mantieni l&apos;iscrizione</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                tone="destructive"
                loading={pending}
                loadingText="Annullamento…"
              >
                Annulla l&apos;iscrizione
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
