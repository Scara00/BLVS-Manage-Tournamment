"use client";

import { AlertCircleIcon, UsersIcon, WifiOffIcon } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";
import {
  ANNULLAMENTO_MESSAGES,
  erroreMotivo,
  initialAnnullaTappaState,
  MOTIVO_MAX,
  type AnnullaTappaAction,
  type AnnullaTappaState,
} from "@/lib/tappe/annullamento/state";

/**
 * «12 iscritti vedranno…», with the number in `font.mono`. The email
 * notices are suspended: the admin is told to tell the players.
 */
function AvvisoIscritti({ iscritti }: { iscritti: number }) {
  if (iscritti <= 0) return <p>Non ci sono iscritti.</p>;
  return (
    <p>
      <span className="font-mono text-lg font-semibold tabular-nums">
        {iscritti}
      </span>{" "}
      {iscritti === 1
        ? "iscritto vedrà la tappa annullata nell'app. Non parte nessuna email: se serve, avvisalo tu."
        : "iscritti vedranno la tappa annullata nell'app. Non parte nessuna email: se serve, avvisali tu."}
    </p>
  );
}

type AnnullaTappaProps = {
  tappaId: string;
  nome: string;
  /** Pending + confirmed players of the stage. */
  iscritti: number;
  /** False once the stage is concluded, cancelled or archived. */
  annullabile: boolean;
  /** The `annullaTappa` server action (a fake in Storybook). */
  action: AnnullaTappaAction;
  /** Where «Accedi di nuovo» returns to. */
  returnPath?: string;
  /** Opens the dialog on mount (Storybook, axe). */
  defaultOpen?: boolean;
  /** Forces the offline state (Storybook). */
  offline?: boolean;
  /** Starting state, e.g. to show an error in Storybook. */
  initialState?: AnnullaTappaState;
  /** Pre-filled reason (Storybook). */
  motivoIniziale?: string;
};

/**
 * w-admin-annulla-tappa: «Annulla tappa» and its confirmation dialog. The
 * reason is required; the dialog says how many players are registered and
 * that no email leaves.
 * Initial focus is on «Non annullare», the safe action; Esc closes it and
 * focus returns to the trigger. After a success the trigger is gone, so the
 * component stays mounted and focus lands on the outcome message.
 */
export function AnnullaTappa({
  tappaId,
  nome,
  iscritti,
  annullabile,
  action,
  returnPath = "/admin",
  defaultOpen = false,
  offline: forceOffline,
  initialState = initialAnnullaTappaState,
  motivoIniziale = "",
}: AnnullaTappaProps) {
  const [open, setOpen] = useState(defaultOpen);
  // What the dialog was opened for: after a success the page already shows
  // the cancelled stage while the dialog fades out.
  const [nelDialog, setNelDialog] = useState({ nome, iscritti });
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const offlineId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const esitoRef = useRef<HTMLParagraphElement>(null);
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  const [tentativi, setTentativi] = useState(0);

  // A failed request (network down) rejects: turn it into «network».
  const safeAction = useCallback<AnnullaTappaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[tappe] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: ANNULLAMENTO_MESSAGES.network,
          fields: {},
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
    if (state.status === "error") {
      setMostraErrore(true);
      if (state.fields.motivo) setTentativi((n) => n + 1);
    }
  }

  useEffect(() => {
    if (tentativi > 0 && formRef.current) focusFirstInvalid(formRef.current);
  }, [tentativi]);

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
  if (!annullabile) return null;

  const errore = state.status === "error" && mostraErrore ? state : null;
  const erroreCampo =
    erroreLocale ??
    (errore?.reason === "invalid" ? errore.fields.motivo : null);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setMostraErrore(false);
          setErroreLocale(null);
          setNelDialog({ nome, iscritti });
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
            aria-label={`Annulla tappa: ${nome}`}
          />
        }
      >
        Annulla tappa
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-xl">
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!online || pending) return;
            const form = event.currentTarget;
            const data = new FormData(form);
            const problema = erroreMotivo(String(data.get("motivo") ?? ""));
            setErroreLocale(problema);
            if (problema) {
              setTentativi((n) => n + 1);
              return;
            }
            startTransition(() => formAction(data));
          }}
          className="contents"
        >
          <input type="hidden" name="tappaId" value={tappaId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Annullare «{nelDialog.nome}»?</AlertDialogTitle>
            <AlertDialogDescription>
              La tappa risulterà «Annullata» a giocatori e admin e non accetterà
              più iscrizioni. Non si potrà riaprire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody className="flex flex-col gap-stack-sm">
            <div
              data-slot="avviso-iscritti"
              className="flex items-start gap-space-2 border-s-4 border-error-fg bg-error-bg p-inset text-error-fg"
            >
              <UsersIcon aria-hidden className="mt-1 size-4 shrink-0" />
              <AvvisoIscritti iscritti={nelDialog.iscritti} />
            </div>
            <Field
              label="Motivo dell'annullamento"
              hint="Resta nell'elenco delle tappe dell'area admin."
              required
              error={erroreCampo ?? undefined}
            >
              <Textarea
                name="motivo"
                maxLength={MOTIVO_MAX}
                defaultValue={motivoIniziale}
                onChange={() => setErroreLocale(null)}
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
                {ANNULLAMENTO_MESSAGES.offline}
              </p>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel>Non annullare</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              tone="destructive"
              loading={pending}
              loadingText="Annullamento…"
              disabled={!online}
              aria-describedby={!online ? offlineId : undefined}
            >
              Annulla tappa
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
