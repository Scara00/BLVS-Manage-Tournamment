"use client";

import { AlertCircleIcon, CheckCheckIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useActionState,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import {
  initialModificaIscrittiState,
  type ModificaIscrittiAction,
  type ModificaIscrittiState,
} from "@/lib/iscrizioni/admin/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import { useAzioneIscritti } from "./use-azione-iscritti";

/**
 * «Conferma tutte»: confirms every pending registration of the stage after
 * one question. It stays mounted while the list is editable, so the result
 * survives the refresh that removes the button (nothing left pending);
 * focus then lands on `esitoId`.
 */
export function ConfermaTutteDialog({
  tappaId,
  inAttesa,
  action,
  esitoId,
  onEsito,
  defaultOpen = false,
  initialState = initialModificaIscrittiState,
}: {
  tappaId: string;
  /** Pending registrations of the stage, both boards. */
  inAttesa: number;
  /** The `confermaIscritti` server action (a fake in Storybook). */
  action: ModificaIscrittiAction;
  /** Where the outcome is written and focus goes after a success. */
  esitoId: string;
  onEsito: (message: string) => void;
  defaultOpen?: boolean;
  initialState?: ModificaIscrittiState;
}) {
  const toast = useToast();
  const safeAction = useAzioneIscritti(action);
  const [state, formAction, pending] = useActionState(safeAction, initialState);
  const [aperto, setAperto] = useState(defaultOpen);
  const [numero, setNumero] = useState(inAttesa);
  // An old error is not shown again when the dialog is reopened.
  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "error") setMostraErrore(true);
  }
  const confermate = useRef(false);
  const gestito = useRef<ModificaIscrittiState | null>(null);

  useEffect(() => {
    if (state.status !== "success" || gestito.current === state) return;
    gestito.current = state;
    confermate.current = true;
    toast.add({ title: state.message });
    onEsito(state.message);
    setAperto(false);
  }, [state, toast, onEsito]);

  const errore = state.status === "error" && mostraErrore ? state : null;
  const titolo =
    numero === 1
      ? "Confermare 1 iscrizione in attesa?"
      : `Confermare ${numero} iscrizioni in attesa?`;

  return (
    <>
      {inAttesa > 0 ? (
        <Button
          variant="primary"
          className="max-w-full"
          onClick={() => {
            setNumero(inAttesa);
            setMostraErrore(false);
            setAperto(true);
          }}
        >
          <CheckCheckIcon aria-hidden className="size-4" />
          Conferma tutte ({inAttesa})
        </Button>
      ) : null}
      <AlertDialog
        open={aperto}
        onOpenChange={(next) => {
          if (pending) return;
          setAperto(next);
        }}
      >
        <AlertDialogContent
          className="max-w-lg"
          finalFocus={() => {
            const dopo = confermate.current;
            confermate.current = false;
            return dopo ? (document.getElementById(esitoId) ?? true) : true;
          }}
        >
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
            <AlertDialogHeader>
              <AlertDialogTitle>{titolo}</AlertDialogTitle>
              <AlertDialogDescription>
                Le iscrizioni confermate entrano nei gironi quando li generi.
                Per togliere un giocatore dopo, usa «Rimuovi» sulla sua riga.
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
                loading={pending}
                loadingText="Conferma…"
              >
                Conferma tutte
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
