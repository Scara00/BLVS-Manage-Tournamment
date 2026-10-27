"use client";

import { AlertCircleIcon, ArchiveIcon, WifiOffIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import {
  ANNULLAMENTO_MESSAGES,
  initialArchiviaTappaState,
  type ArchiviaTappaAction,
  type ArchiviaTappaState,
} from "@/lib/tappe/annullamento/state";

type ArchiviaTappaProps = {
  tappaId: string;
  nome: string;
  /** Mirrors the server rule: cancelled, or both boards concluded. */
  archiviabile: boolean;
  /** Already archived: nothing to do, the stage is read-only. */
  archiviata: boolean;
  /** The `archiviaTappa` server action (a fake in Storybook). */
  action: ArchiviaTappaAction;
  defaultOpen?: boolean;
  offline?: boolean;
  initialState?: ArchiviaTappaState;
};

/**
 * «Archivia»: disabled, with a visible note, until the results of both
 * boards are closed (BLVS-43) or the stage is cancelled. The server refuses
 * it anyway. The note is our own `<p>`: Button's `disabledReason` would
 * remount the button when it turns enabled and drop focus.
 */
export function ArchiviaTappa({
  tappaId,
  nome,
  archiviabile,
  archiviata,
  action,
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialArchiviaTappaState,
}: ArchiviaTappaProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [nomeNelDialog, setNomeNelDialog] = useState(nome);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const notaId = useId();
  const offlineId = useId();
  const esitoRef = useRef<HTMLParagraphElement>(null);

  const safeAction = useCallback<ArchiviaTappaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[tappe] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: ANNULLAMENTO_MESSAGES.network,
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
    if (state.status === "success") setOpen(false);
    if (state.status === "error") setMostraErrore(true);
  }

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: state.message });
    const esito = esitoRef.current;
    if (esito) {
      esito.focus({ preventScroll: true });
      esito.scrollIntoView({ block: "nearest" });
    }
  }, [state, toast]);

  if (state.status === "success") {
    return (
      <p
        ref={esitoRef}
        tabIndex={-1}
        className="self-start text-sm font-semibold focus-ring"
      >
        {state.message}
      </p>
    );
  }
  if (archiviata) return null;

  const errore = state.status === "error" && mostraErrore ? state : null;

  return (
    <div className="flex max-w-full flex-col items-start gap-space-1">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) {
            setMostraErrore(false);
            setNomeNelDialog(nome);
          }
          setOpen(next);
        }}
      >
        <AlertDialogTrigger
          render={
            <Button
              variant="secondary"
              size="sm"
              className="max-w-full"
              disabled={!archiviabile}
              focusableWhenDisabled
              aria-label={`Archivia: ${nome}`}
              aria-describedby={archiviabile ? undefined : notaId}
            />
          }
        >
          <ArchiveIcon aria-hidden data-icon="inline-start" />
          Archivia
        </AlertDialogTrigger>
        <AlertDialogContent>
          <form
            action={formAction}
            onSubmit={(event) => {
              if (!online || pending) event.preventDefault();
            }}
            className="contents"
          >
            <input type="hidden" name="tappaId" value={tappaId} />
            <AlertDialogHeader>
              <AlertDialogTitle>Archiviare «{nomeNelDialog}»?</AlertDialogTitle>
              <AlertDialogDescription>
                La tappa resterà consultabile, ma nessuno potrà più modificarla:
                né i dati, né le iscrizioni, né i risultati.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody className="flex flex-col gap-stack-sm">
              {errore ? (
                <p
                  role="alert"
                  className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset font-semibold text-error-fg"
                >
                  <AlertCircleIcon
                    aria-hidden
                    className="mt-1 size-4 shrink-0"
                  />
                  {errore.message}
                </p>
              ) : null}
              {!online ? (
                <p
                  id={offlineId}
                  className="flex items-start gap-space-2 font-medium"
                >
                  <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
                  {ANNULLAMENTO_MESSAGES.offline}
                </p>
              ) : null}
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel>Non archiviare</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                loading={pending}
                loadingText="Archiviazione…"
                disabled={!online}
                aria-describedby={!online ? offlineId : undefined}
              >
                Archivia
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
      {archiviabile ? null : (
        <p id={notaId} className="text-sm text-muted-foreground">
          {ANNULLAMENTO_MESSAGES.archiviaNota}
        </p>
      )}
    </div>
  );
}
