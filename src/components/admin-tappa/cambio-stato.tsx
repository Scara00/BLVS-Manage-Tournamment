"use client";

import { AlertCircleIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import type { TransizioneView } from "@/lib/tappe/gestione-format";
import {
  GESTIONE_MESSAGES,
  gestioneTappaPath,
  initialCambioStatoState,
  type CambioStatoAction,
  type CambioStatoState,
} from "@/lib/tappe/gestione-state";

/** Confirmation of a change of state: what it does, Ora → Dopo. */
export function ConfrontoOraDopo({
  confronto,
}: {
  confronto: TransizioneView["confronto"];
}) {
  return (
    <table className="w-full table-fixed border-collapse text-start text-base">
      <caption className="mb-space-2 text-start font-heading font-semibold">
        Cosa cambia
      </caption>
      <thead>
        <tr className="border-b-2 border-input">
          <th scope="col" className="w-[30%] py-space-2 pe-space-2 text-start">
            Aspetto
          </th>
          <th scope="col" className="py-space-2 pe-space-2 text-start">
            Ora
          </th>
          <th scope="col" className="py-space-2 text-start">
            Dopo
          </th>
        </tr>
      </thead>
      <tbody>
        {confronto.map((riga) => {
          const cambia = riga.ora !== riga.dopo;
          return (
            <tr
              key={riga.aspetto}
              className="border-b border-border align-top [overflow-wrap:anywhere]"
            >
              <th
                scope="row"
                className="py-space-2 pe-space-2 text-start font-medium"
              >
                {riga.aspetto}
              </th>
              <td className="py-space-2 pe-space-2">{riga.ora}</td>
              <td
                className={cambia ? "py-space-2 font-semibold" : "py-space-2"}
              >
                <span aria-hidden="true">→ </span>
                {riga.dopo}
                {cambia ? null : <span className="sr-only"> (invariato)</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

type CambioStatoProps = {
  tappaId: string;
  /** The next step; `null` once the flow has nothing left to do here. */
  transizione: TransizioneView | null;
  /** The `cambiaStatoTappa` server action (a fake in Storybook). */
  action: CambioStatoAction;
  /** Opens the dialog on mount (Storybook, axe). */
  defaultOpen?: boolean;
  /** Forces the offline state (Storybook). */
  offline?: boolean;
  /** Starting state, e.g. to show an error in Storybook. */
  initialState?: CambioStatoState;
};

/**
 * w-admin-stato-conferma: the button that moves the stage one step along
 * the flow, and the dialog that asks for confirmation. Esc and «Annulla»
 * close it without changes; focus returns to the button. It stays mounted
 * when the last step is done, so focus can land on the closing message.
 */
export function CambioStato({
  tappaId,
  transizione,
  action,
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialCambioStatoState,
}: CambioStatoProps) {
  const [open, setOpen] = useState(defaultOpen);
  // The dialog keeps the step it was opened for: after a success the page
  // already shows the next one while the dialog fades out.
  const [nelDialog, setNelDialog] = useState(transizione);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const bloccoId = useId();
  const offlineId = useId();
  const fineRef = useRef<HTMLParagraphElement>(null);

  // A failed request (network down, server unreachable) rejects instead of
  // returning a state: turn it into the «network» error.
  const safeAction = useCallback<CambioStatoAction>(
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

  // A new result: close the dialog after a success (adjusting state during
  // render, not in an effect). Base UI gives focus back to the trigger.
  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "success") setOpen(false);
    if (state.status === "error") setMostraErrore(true);
  }

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: state.message });
    // The trigger is gone with the last step: keep focus on the page.
    const fine = fineRef.current;
    if (fine) {
      fine.focus({ preventScroll: true });
      fine.scrollIntoView({ block: "nearest" });
    }
  }, [state, toast]);

  if (!transizione) {
    return (
      <p ref={fineRef} tabIndex={-1} className="self-start focus-ring">
        Non ci sono altri passaggi di stato da questa pagina.
      </p>
    );
  }

  const errore = state.status === "error" && mostraErrore ? state : null;
  const bloccata = transizione.bloccata;
  const dialogo = nelDialog ?? transizione;

  return (
    <div className="flex flex-col items-start gap-space-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) {
            setMostraErrore(false);
            setNelDialog(transizione);
          }
          setOpen(next);
        }}
      >
        <AlertDialogTrigger
          render={
            <Button
              variant="primary"
              disabled={bloccata !== null}
              focusableWhenDisabled
              aria-describedby={bloccata ? bloccoId : undefined}
            />
          }
        >
          {transizione.azione}
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-xl">
          <form
            action={formAction}
            onSubmit={(event) => {
              if (!online || pending) event.preventDefault();
            }}
            className="contents"
          >
            <input type="hidden" name="tappaId" value={tappaId} />
            <input type="hidden" name="da" value={dialogo.da} />
            <input type="hidden" name="a" value={dialogo.a} />
            <AlertDialogHeader>
              <AlertDialogTitle>{dialogo.titolo}</AlertDialogTitle>
              <AlertDialogDescription>{dialogo.effetto}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody className="flex flex-col gap-stack-sm">
              <ConfrontoOraDopo confronto={dialogo.confronto} />
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
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                loading={pending}
                loadingText={dialogo.inCorso}
                disabled={!online}
                aria-describedby={!online ? offlineId : undefined}
              >
                {dialogo.conferma}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {bloccata ? (
        <p id={bloccoId} className="text-base">
          {bloccata}
        </p>
      ) : null}
    </div>
  );
}
