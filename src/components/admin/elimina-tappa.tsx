"use client";

import { AlertCircleIcon, Trash2Icon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
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
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  ELIMINAZIONE_MESSAGES,
  erroreConferma,
  initialEliminaTappaState,
  PAROLA_CONFERMA,
  type EliminaTappaAction,
  type EliminaTappaState,
} from "@/lib/tappe/eliminazione/state";

/** What goes with the stage, said before asking. */
function CosaSiPerde({
  iscritti,
  conRisultati,
}: {
  iscritti: number;
  conRisultati: boolean;
}) {
  return (
    <ul className="flex list-disc flex-col gap-space-1 ps-space-5">
      {iscritti > 0 ? (
        <li>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {iscritti}
          </span>{" "}
          {iscritti === 1
            ? "iscrizione viene cancellata, senza avviso all'iscritto."
            : "iscrizioni vengono cancellate, senza avviso agli iscritti."}
        </li>
      ) : (
        <li>Nessuna iscrizione da cancellare.</li>
      )}
      {conRisultati ? (
        <li>
          Gironi, partite e punteggi spariscono, e con loro i punti nella
          classifica generale della stagione.
        </li>
      ) : null}
    </ul>
  );
}

type EliminaTappaProps = {
  tappaId: string;
  nome: string;
  /** Registrations of both boards: they are deleted with the stage. */
  iscritti: number;
  /** Started or over: its points are in the overall standing. */
  conRisultati: boolean;
  /** The `eliminaTappa` server action (a fake in Storybook). */
  action: EliminaTappaAction;
  /** Where «Accedi di nuovo» returns to. */
  returnPath?: string;
  /** Opens the dialog on mount (Storybook, axe). */
  defaultOpen?: boolean;
  /** Forces the offline state (Storybook). */
  offline?: boolean;
  /** Starting state, e.g. to show an error in Storybook. */
  initialState?: EliminaTappaState;
};

/**
 * «Elimina tappa» and its confirmation dialog: the stage goes for good,
 * in any state, with everything it owns. The dialog says what is lost and
 * asks to type ELIMINA. Initial focus is on «Non eliminare», the safe
 * action; Esc closes it and focus returns to the trigger. On success the
 * row leaves the table with this component, so the toast is raised from
 * the action itself.
 */
export function EliminaTappa({
  tappaId,
  nome,
  iscritti,
  conRisultati,
  action,
  returnPath = "/admin",
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialEliminaTappaState,
}: EliminaTappaProps) {
  const [open, setOpen] = useState(defaultOpen);
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const offlineId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [conferma, setConferma] = useState("");
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  const [tentativi, setTentativi] = useState(0);

  // A failed request (network down) rejects: turn it into «network».
  const safeAction = useCallback<EliminaTappaAction>(
    async (prev, formData) => {
      let state: EliminaTappaState;
      try {
        state = await action(prev, formData);
      } catch (error) {
        console.error("[tappe] richiesta non riuscita", error);
        state = {
          status: "error",
          reason: "network",
          message: ELIMINAZIONE_MESSAGES.network,
          fields: {},
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
      if (state.status === "success") toast.add({ title: state.message });
      return state;
    },
    [action, toast],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);

  const [visto, setVisto] = useState(state);
  const [mostraErrore, setMostraErrore] = useState(
    initialState.status === "error",
  );
  if (state !== visto) {
    setVisto(state);
    if (state.status === "success") setOpen(false);
    if (state.status === "error") {
      setMostraErrore(true);
      if (state.fields.conferma) setTentativi((n) => n + 1);
    }
  }

  useEffect(() => {
    if (tentativi > 0 && formRef.current) focusFirstInvalid(formRef.current);
  }, [tentativi]);

  const errore = state.status === "error" && mostraErrore ? state : null;
  const erroreCampo =
    erroreLocale ??
    (errore?.reason === "invalid" ? errore.fields.conferma : null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setMostraErrore(false);
          setErroreLocale(null);
          setConferma("");
        }
        setOpen(next);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            className="max-w-full border-error-fg text-error-fg"
            aria-label={`Elimina tappa: ${nome}`}
          />
        }
      >
        <Trash2Icon aria-hidden className="size-4 shrink-0" />
        Elimina tappa
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-xl">
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!online || pending) return;
            const problema = erroreConferma(conferma);
            setErroreLocale(problema);
            if (problema) {
              setTentativi((n) => n + 1);
              return;
            }
            const data = new FormData(event.currentTarget);
            data.set("conferma", conferma);
            startTransition(() => formAction(data));
          }}
          className="contents"
        >
          <input type="hidden" name="tappaId" value={tappaId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{nome}»?</AlertDialogTitle>
            <AlertDialogDescription>
              La tappa sparisce per sempre, con tabelloni, iscrizioni, gironi,
              partite e punteggi. Non si può annullare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody className="flex flex-col gap-stack-sm">
            <div
              data-slot="cosa-si-perde"
              className="border-s-4 border-error-fg bg-error-bg p-inset text-error-fg"
            >
              <CosaSiPerde iscritti={iscritti} conRisultati={conRisultati} />
            </div>
            <Field
              label={`Scrivi ${PAROLA_CONFERMA} per confermare`}
              required
              error={erroreCampo ?? undefined}
              className="max-w-md"
            >
              <Input
                name="conferma"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono"
                value={conferma}
                onValueChange={(value) => {
                  setConferma(value);
                  setErroreLocale(null);
                }}
              />
            </Field>
            {errore && errore.reason !== "invalid" ? (
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
                    href={sessionExpiredHref(returnPath)}
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
                {ELIMINAZIONE_MESSAGES.offline}
              </p>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Non eliminare</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              tone="destructive"
              loading={pending}
              loadingText="Eliminazione…"
              disabled={!online}
              aria-describedby={!online ? offlineId : undefined}
            >
              Elimina tappa
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
