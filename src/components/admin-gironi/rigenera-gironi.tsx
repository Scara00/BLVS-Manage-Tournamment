"use client";

import { AlertCircleIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Tape } from "@/components/scoreboard";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Fieldset, focusFirstInvalid } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useOnline } from "@/hooks/use-online";
import {
  avvisoPerdita,
  contaPunteggi,
  descriviPunteggioPerso,
  descriviSets,
  descriviSquadra,
  erroreConferma,
  etichettaConferma,
  partitaPersa,
} from "@/lib/gironi/rigenera/format";
import {
  initialRigeneraState,
  RIGENERA_MESSAGES as M,
  type PunteggioPerso,
  type RigeneraAction,
  type RigeneraState,
  type RigenerazioneTabellone,
} from "@/lib/gironi/rigenera/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

type RigeneraGironiProps = {
  rigenerazione: RigenerazioneTabellone;
  /** Server action, passed in by the page (a fake in Storybook). */
  rigenera: RigeneraAction;
  /** Storybook: open the confirmation at once. */
  defaultOpen?: boolean;
  /** Storybook: a starting result (e.g. `fieldErrors`). */
  initialState?: RigeneraState;
  /** Storybook: show the request in flight. */
  loading?: boolean;
  /** Storybook: force the offline state. */
  offline?: boolean;
};

function ElencoPunteggi({ punteggi }: { punteggi: PunteggioPerso[] }) {
  return (
    <ul
      aria-label="Punteggi che si perdono"
      className="flex flex-col border-2 border-error-fg"
    >
      {punteggi.map((p) => (
        <li
          key={p.partitaId}
          aria-label={descriviPunteggioPerso(p)}
          className="flex flex-col gap-space-1 border-b border-border p-space-3 [overflow-wrap:anywhere] last:border-b-0"
        >
          <span aria-hidden className="font-heading font-semibold">
            {partitaPersa(p)}
          </span>
          <span aria-hidden className="text-sm">
            {descriviSquadra(p.squadraA)}{" "}
            <span className="text-muted-foreground">contro</span>{" "}
            {descriviSquadra(p.squadraB)}
          </span>
          <span aria-hidden className="font-mono text-base font-semibold">
            {descriviSets(p.sets)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Avviso({
  message,
  sessione,
  da,
}: {
  message: string;
  sessione: boolean;
  da: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset text-error-fg"
    >
      <p className="flex items-start gap-space-2 font-semibold">
        <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
        <span>
          <span className="sr-only">Errore: </span>
          {message}
        </span>
      </p>
      {sessione ? (
        <Link
          href={sessionExpiredHref(da)}
          className={buttonVariants({ variant: "primary" })}
        >
          Accedi di nuovo
        </Link>
      ) : null}
    </div>
  );
}

/**
 * «Rigenera gironi» of one board (w-admin-gironi) and its confirmation
 * (w-admin-rigenera-conferma). With no score entered the board is redrawn
 * at once. With scores, the dialog says how many and which ones are lost
 * and asks to tick a box: the confirm button stays active, and without the
 * tick the error appears next to the box, which receives focus.
 */
export function RigeneraGironi({
  rigenerazione,
  rigenera,
  defaultOpen = false,
  initialState = initialRigeneraState,
  loading = false,
  offline: forceOffline,
}: RigeneraGironiProps) {
  const { tappaId, categoria } = rigenerazione;
  const pathname = usePathname();
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const toast = useToast();
  const titoloId = useId();
  const offlineId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const fineRef = useRef<HTMLParagraphElement>(null);

  // A failed request (network down) rejects instead of returning a state.
  const safeAction = useCallback<RigeneraAction>(
    async (prev, formData) => {
      try {
        return await rigenera(prev, formData);
      } catch (error) {
        console.error("[gironi] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: M.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [rigenera],
  );
  const [state, formAction, actionPending] = useActionState(
    safeAction,
    initialState,
  );
  const [, startTransition] = useTransition();
  const pending = actionPending || loading;

  // The scores shown: the page's, or the fresh ones after a conflict. The
  // dialog keeps them while it is open, so a refresh() after success does
  // not change its content mid-animation.
  const [punteggi, setPunteggi] = useState(rigenerazione.punteggi);
  const [daPagina, setDaPagina] = useState(rigenerazione.punteggi);
  const [open, setOpen] = useState(defaultOpen);
  const [spuntata, setSpuntata] = useState(false);
  const [errore, setErrore] = useState<string | null>(
    initialState.status === "fieldErrors" ? initialState.fields.conferma : null,
  );
  const [avviso, setAvviso] = useState<RigeneraState | null>(
    initialState.status === "error" ? initialState : null,
  );
  /** Bumped on every refused confirmation, to move focus each time. */
  const [tentativi, setTentativi] = useState(0);
  const [fine, setFine] = useState<string | null>(null);
  /** The last confirmation succeeded: the dialog hands focus to `fine`. */
  const [riuscita, setRiuscita] = useState(false);

  if (rigenerazione.punteggi !== daPagina) {
    setDaPagina(rigenerazione.punteggi);
    if (!open) setPunteggi(rigenerazione.punteggi);
  }

  // A new result, handled during render (not in an effect).
  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    switch (state.status) {
      case "success":
        setRiuscita(true);
        setOpen(false);
        setAvviso(null);
        setErrore(null);
        setFine(state.message);
        setPunteggi([]);
        break;
      case "fieldErrors":
        setErrore(state.fields.conferma);
        setTentativi((n) => n + 1);
        break;
      case "error":
        setAvviso(state);
        if (state.reason === "conflict" && state.punteggi) {
          setPunteggi(state.punteggi);
          setSpuntata(false);
          setErrore(null);
          if (state.punteggi.length > 0) setOpen(true);
        }
        break;
    }
  }

  useEffect(() => {
    if (state.status !== "success") return;
    toast.add({ title: state.message });
  }, [state, toast]);

  useEffect(() => {
    if (tentativi === 0) return;
    const form = formRef.current;
    if (form) focusFirstInvalid(form);
  }, [tentativi]);

  // In direct mode (no dialog) focus goes to the closing message.
  useEffect(() => {
    if (state.status !== "success" || open) return;
    const p = fineRef.current;
    if (!p) return;
    p.focus({ preventScroll: true });
    p.scrollIntoView?.({ block: "nearest" });
  }, [state, open]);

  const persi = punteggi.length;
  const conConferma = persi > 0;

  function invia(form: HTMLFormElement) {
    if (!online || pending) return;
    startTransition(() => formAction(new FormData(form)));
  }

  function onConferma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !online) return;
    if (conConferma && !spuntata) {
      setErrore(erroreConferma(persi));
      setTentativi((n) => n + 1);
      return;
    }
    setAvviso(null);
    invia(event.currentTarget);
  }

  function onDiretta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (conConferma) return;
    setAvviso(null);
    setFine(null);
    invia(event.currentTarget);
  }

  const campiNascosti = (
    <>
      <input type="hidden" name="tappaId" value={tappaId} />
      <input type="hidden" name="categoria" value={categoria} />
      <input type="hidden" name="attesi" value={persi} />
    </>
  );
  const avvisoAttivo = avviso?.status === "error" ? avviso : null;

  return (
    <section
      aria-labelledby={titoloId}
      data-testid="rigenera-gironi"
      className="flex flex-col items-start gap-stack-sm border-t-2 border-border pt-stack"
    >
      <h2 id={titoloId} className="font-heading text-xl font-bold">
        Rigenera i gironi
      </h2>
      <p className="[overflow-wrap:anywhere]">
        Un nuovo sorteggio rifà gironi e partite di questo tabellone.{" "}
        {conConferma ? (
          <>
            Sono già stati inseriti{" "}
            <strong className="font-mono">{contaPunteggi(persi)}</strong>: prima
            di rigenerare ti chiediamo di confermare che si perdono.
          </>
        ) : (
          "Non ci sono punteggi inseriti: la rigenerazione è immediata."
        )}
      </p>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) {
            setRiuscita(false);
            setSpuntata(false);
            setErrore(null);
            setAvviso(null);
            setFine(null);
          }
          setOpen(next);
        }}
      >
        {conConferma ? (
          <Button
            variant="primary"
            className="max-w-full"
            onClick={() => {
              setRiuscita(false);
              setSpuntata(false);
              setErrore(null);
              setAvviso(null);
              setFine(null);
              setOpen(true);
            }}
          >
            Rigenera gironi
          </Button>
        ) : (
          <form onSubmit={onDiretta}>
            {campiNascosti}
            <input type="hidden" name="conferma" value="" />
            <Button
              type="submit"
              variant="primary"
              className="max-w-full"
              loading={pending}
              disabled={!online}
              focusableWhenDisabled
              aria-describedby={!online ? offlineId : undefined}
            >
              Rigenera gironi
            </Button>
          </form>
        )}
        <AlertDialogContent
          className="max-w-xl"
          // After a success focus lands on the closing message; on cancel
          // it goes back to «Rigenera gironi».
          finalFocus={() => (riuscita ? fineRef.current : true)}
        >
          <form
            ref={formRef}
            onSubmit={onConferma}
            noValidate
            className="contents"
          >
            {campiNascosti}
            <input type="hidden" name="conferma" value={spuntata ? "on" : ""} />
            <AlertDialogHeader>
              <AlertDialogTitle>Rigenerare i gironi?</AlertDialogTitle>
              <AlertDialogDescription>
                Gironi e partite di questo tabellone vengono sorteggiati di
                nuovo. L&apos;operazione resta nel registro.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody className="flex flex-col gap-stack-sm">
              <div className="flex flex-col gap-space-2">
                <Tape size={8} />
                <p className="flex items-start gap-space-2 border-l-4 border-error-fg bg-error-bg p-space-3 font-semibold text-error-fg">
                  <AlertCircleIcon
                    aria-hidden
                    className="mt-1 size-4 shrink-0"
                  />
                  <span>
                    {avvisoPerdita(persi)}
                    {persi > 0 ? (
                      <span className="font-normal">
                        {" "}
                        Questi sono i punteggi che si perdono:
                      </span>
                    ) : null}
                  </span>
                </p>
              </div>
              {persi > 0 ? <ElencoPunteggi punteggi={punteggi} /> : null}
              {avvisoAttivo ? (
                <Avviso
                  message={avvisoAttivo.message}
                  sessione={avvisoAttivo.reason === "sessionExpired"}
                  da={pathname}
                />
              ) : null}
              {persi > 0 ? (
                <Fieldset
                  legend="Conferma"
                  required
                  error={errore ?? undefined}
                >
                  <Checkbox
                    label={etichettaConferma(persi)}
                    checked={spuntata}
                    onCheckedChange={(checked) => {
                      setSpuntata(checked);
                      if (checked) setErrore(null);
                    }}
                  />
                </Fieldset>
              ) : null}
              {!online ? (
                <p
                  id={`${offlineId}-dialog`}
                  className="flex items-start gap-space-2 font-medium"
                >
                  <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
                  {M.offline}
                </p>
              ) : null}
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel className="max-w-full">
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                className="max-w-full"
                tone="destructive"
                loading={pending}
                loadingText="Rigenerazione…"
                disabled={!online}
                aria-describedby={!online ? `${offlineId}-dialog` : undefined}
              >
                {persi > 0
                  ? `Rigenera e perdi ${contaPunteggi(persi)}`
                  : "Rigenera"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {!online && !open ? (
        <p id={offlineId} className="flex items-start gap-space-2 font-medium">
          <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
          {M.offline}
        </p>
      ) : null}
      {avvisoAttivo && !open ? (
        <Avviso
          message={avvisoAttivo.message}
          sessione={avvisoAttivo.reason === "sessionExpired"}
          da={pathname}
        />
      ) : null}
      <p
        ref={fineRef}
        tabIndex={-1}
        role="status"
        data-testid="rigenera-esito"
        className={
          fine
            ? "self-stretch border-l-4 border-tape p-space-2 font-semibold focus-ring"
            : "sr-only"
        }
      >
        {fine}
      </p>
    </section>
  );
}
