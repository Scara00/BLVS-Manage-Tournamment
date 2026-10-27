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
import { ISCRITTI_MESSAGES } from "@/lib/iscrizioni/admin/messages";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import {
  initialModificaIscrittiState,
  type IscrittoView,
  type ModificaIscrittiAction,
  type ModificaIscrittiState,
} from "@/lib/iscrizioni/admin/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

/** Who the dialog asks about, kept from the moment it opened. */
export type DaRimuovere = {
  iscritto: IscrittoView;
  /** «Maschile» / «Femminile». */
  tabellone: string;
  /** Where focus goes after a removal (the row is gone by then). */
  esitoId: string;
};

type RimuoviIscrittoDialogProps = {
  tappaId: string;
  /** `null` when closed. */
  target: DaRimuovere | null;
  onClose: (esito: { rimosso: boolean; message?: string }) => void;
  /** The «Rimuovi» button that opened it: focus returns there on cancel. */
  returnFocus: React.RefObject<HTMLElement | null>;
  /** The `rimuoviIscritto` server action (a fake in Storybook). */
  action: ModificaIscrittiAction;
  initialState?: ModificaIscrittiState;
};

/**
 * Confirmation before removing a registrant. One dialog for the page,
 * opened by the «Rimuovi» of a row: the row disappears on success, so the
 * dialog must not live inside it. Esc and «Annulla» change nothing and
 * give focus back to the button; after a removal focus lands on the
 * board's message «Posto N di nuovo libero».
 */
export function RimuoviIscrittoDialog({
  tappaId,
  target,
  onClose,
  returnFocus,
  action,
  initialState = initialModificaIscrittiState,
}: RimuoviIscrittoDialogProps) {
  const toast = useToast();
  // The content stays on the registrant it was opened for while it fades.
  const [mostrato, setMostrato] = useState(target);
  const rimosso = useRef(false);
  const gestito = useRef<ModificaIscrittiState | null>(null);

  const safeAction = useCallback<ModificaIscrittiAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[iscritti] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: ISCRITTI_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
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
    rimosso.current = true;
    toast.add({ title: state.message });
    onClose({ rimosso: true, message: state.message });
  }, [state, toast, onClose]);

  const dati = target ?? mostrato;
  const errore = state.status === "error" && mostraErrore ? state : null;

  return (
    <AlertDialog
      open={target !== null}
      onOpenChange={(next) => {
        if (pending || next) return;
        onClose({ rimosso: false });
      }}
    >
      <AlertDialogContent
        className="max-w-lg"
        finalFocus={() => {
          const dopoRimozione = rimosso.current;
          rimosso.current = false;
          if (dopoRimozione && dati) {
            return document.getElementById(dati.esitoId) ?? true;
          }
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
            <input type="hidden" name="tappaId" value={tappaId} />
            <input type="hidden" name="iscrizioneId" value={dati.iscritto.id} />
            <input type="hidden" name="nome" value={dati.iscritto.nome} />
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dati.iscritto.posto === null
                  ? `Rimuovere ${dati.iscritto.nome}?`
                  : `Rimuovere ${dati.iscritto.nome} dal posto ${dati.iscritto.posto}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                L&apos;iscrizione al tabellone {dati.tabellone.toLowerCase()}{" "}
                viene ritirata e il posto torna libero per un altro giocatore.
                Si potrà aggiungere di nuovo con «Aggiungi giocatore».
              </AlertDialogDescription>
            </AlertDialogHeader>
            {errore ? (
              <AlertDialogBody>
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
                      href={sessionExpiredHref(iscrittiPath(tappaId))}
                      className={buttonVariants({ variant: "primary" })}
                    >
                      Accedi di nuovo
                    </Link>
                  ) : null}
                </div>
              </AlertDialogBody>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                tone="destructive"
                loading={pending}
                loadingText="Rimozione…"
              >
                Rimuovi
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
