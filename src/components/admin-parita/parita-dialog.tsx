"use client";

import { AlertCircleIcon, ArrowUpDownIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, focusFirstInvalid } from "@/components/ui/field";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Textarea } from "@/components/ui/textarea";
import { useOnline } from "@/hooks/use-online";
import {
  annuncioScambio,
  erroriMotivo,
  formatValore,
  motivoDaTesto,
  ordinale,
  ordineCambiato,
  scambia,
  titoloParita,
} from "@/lib/gironi/parita/format";
import {
  initialRisolviParitaState,
  MOTIVI_PARITA,
  NOTE_PARITA_MAX,
  PARITA_MESSAGES as M,
  type CampiParita,
  type MotivoParita,
  type ParitaGirone,
  type ParitaVista,
  type RisolviParitaAction,
  type RisolviParitaState,
} from "@/lib/gironi/parita/types";
import { sessionExpiredHref } from "@/lib/navigation/auth-paths";

export type ParitaDialogProps = {
  girone: Pick<
    ParitaGirone,
    "tappaId" | "categoria" | "gironeId" | "gironeNome"
  >;
  /** The tie as it was when the dialog opened; kept while it is open. */
  parita: ParitaVista;
  /** Server action `risolviParita` (a fake in Storybook). */
  risolvi: RisolviParitaAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The order was saved: `message` announces it. */
  onRiuscita: (message: string) => void;
  /** Where focus goes when the dialog closes (see Base UI `finalFocus`). */
  finalFocus?: () => HTMLElement | boolean | null;
  /** Storybook: a starting result (e.g. `fieldErrors`). */
  initialState?: RisolviParitaState;
  /** Storybook: show the request in flight (confirmation open). */
  loading?: boolean;
  /** Storybook: force the offline state. */
  offline?: boolean;
};

function Avviso({
  stato,
  da,
  onRicarica,
}: {
  stato: Extract<RisolviParitaState, { status: "error" }>;
  da: string;
  onRicarica: () => void;
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
          {stato.message}
        </span>
      </p>
      {stato.reason === "sessionExpired" ? (
        <Link
          href={sessionExpiredHref(da)}
          className={buttonVariants({
            variant: "primary",
            className: "max-w-full",
          })}
        >
          Accedi di nuovo
        </Link>
      ) : null}
      {stato.reason === "conflict" || stato.reason === "notFound" ? (
        <Button variant="secondary" className="max-w-full" onClick={onRicarica}>
          Ricarica la classifica
        </Button>
      ) : null}
    </div>
  );
}

/**
 * The tied players in every criterion: each criterion lists every player
 * with their value, wrapping instead of scrolling sideways.
 */
function CriteriPari({ parita }: { parita: ParitaVista }) {
  const nomi = new Map(parita.giocatori.map((g) => [g.iscrizioneId, g.nome]));
  const titoloId = useId();
  return (
    <section aria-labelledby={titoloId} className="flex flex-col gap-space-2">
      <h3 id={titoloId} className="font-heading font-semibold">
        Pari in ogni criterio
      </h3>
      <dl className="flex flex-col border-2 border-primary">
        {parita.criteri.map((c) => (
          <div
            key={c.id}
            data-testid="criterio-pari"
            className="flex flex-col gap-space-1 border-b border-neutral-200 p-space-3 last:border-b-0"
          >
            <dt className="flex flex-wrap items-center gap-space-2 font-heading font-semibold">
              {c.etichetta}
              <Badge variant="tape">Pari</Badge>
            </dt>
            <dd className="text-sm">{c.spiegazione}</dd>
            <dd>
              <ul
                aria-label={`${c.etichetta} dei giocatori pari`}
                className="flex flex-wrap gap-x-space-4 gap-y-space-1"
              >
                {c.valori.map((v) => (
                  <li
                    key={v.iscrizioneId}
                    className="flex min-w-0 items-baseline gap-space-2 [overflow-wrap:anywhere]"
                  >
                    <span>{nomi.get(v.iscrizioneId)}</span>
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {formatValore(c.id, v.valore)}
                    </span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * w-admin-parita: the admin decides the order of a perfect tie. The tied
 * players are shown in every criterion; «Scambia ↕» swaps two neighbours,
 * one explicit action at a time, and every swap is announced. The reason is
 * a preset plus free text. «Conferma l'ordine» asks once more in a separate
 * confirmation, and only then the order is saved and logged with its
 * author in the registro.
 */
export function ParitaDialog({
  girone,
  parita,
  risolvi,
  open,
  onOpenChange,
  onRiuscita,
  finalFocus,
  initialState = initialRisolviParitaState,
  loading = false,
  offline: forceOffline,
}: ParitaDialogProps) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useOnline(
    forceOffline === undefined ? undefined : !forceOffline,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const annuncioId = useId();
  const offlineId = useId();

  // A failed request (network down) rejects instead of returning a state.
  const safeAction = useCallback<RisolviParitaAction>(
    async (prev, formData) => {
      try {
        return await risolvi(prev, formData);
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
    [risolvi],
  );
  const [state, formAction, actionPending] = useActionState(
    safeAction,
    initialState,
  );
  const [, startTransition] = useTransition();
  const pending = actionPending || loading;

  const iniziale = parita.giocatori.map((g) => g.iscrizioneId);
  const nomi = new Map(parita.giocatori.map((g) => [g.iscrizioneId, g.nome]));
  const precedente = parita.decisione
    ? motivoDaTesto(parita.decisione.motivo)
    : null;

  const [ordine, setOrdine] = useState<string[]>(iniziale);
  const [motivo, setMotivo] = useState<MotivoParita | null>(
    precedente?.motivo ?? null,
  );
  const [note, setNote] = useState(precedente?.note ?? "");
  const [annuncio, setAnnuncio] = useState("");
  const [conferma, setConferma] = useState(loading);
  const [campi, setCampi] = useState<CampiParita>(
    initialState.status === "fieldErrors" ? initialState.fields : {},
  );
  const [avviso, setAvviso] = useState(
    initialState.status === "error" ? initialState : null,
  );
  /** Bumped on every refused confirmation, to move focus each time. */
  const [tentativi, setTentativi] = useState(0);

  // A new result, handled during render (not in an effect).
  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    setConferma(false);
    switch (state.status) {
      case "fieldErrors":
        setCampi(state.fields);
        setTentativi((n) => n + 1);
        break;
      case "error":
        setAvviso(state);
        break;
      case "success":
        setAvviso(null);
        setCampi({});
        break;
    }
  }

  useEffect(() => {
    if (state.status === "success") onRiuscita(state.message);
  }, [state, onRiuscita]);

  useEffect(() => {
    if (tentativi === 0) return;
    const form = formRef.current;
    if (form) focusFirstInvalid(form);
  }, [tentativi]);

  const nomiOrdine = ordine.map((id) => nomi.get(id) ?? id);
  const cambiato = ordineCambiato(iniziale, ordine);
  const decisa = parita.decisione !== null;

  function onScambia(i: number) {
    const nuovo = scambia(ordine, i);
    setOrdine(nuovo);
    setAnnuncio(
      annuncioScambio(
        parita.posizione,
        nuovo.map((id) => nomi.get(id) ?? id),
      ),
    );
  }

  function onConfermaOrdine() {
    if (pending || !online) return;
    const errori = erroriMotivo(motivo, note);
    if (errori) {
      setCampi(errori);
      setTentativi((n) => n + 1);
      return;
    }
    setCampi({});
    setAvviso(null);
    setConferma(true);
  }

  function onDecidi() {
    const form = formRef.current;
    if (!form || pending || !online) return;
    startTransition(() => formAction(new FormData(form)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl" finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>
            {decisa ? "Modifica la decisione" : "Parità da risolvere"} ·{" "}
            {girone.gironeNome}
          </DialogTitle>
          <DialogDescription>
            {titoloParita(parita.posizione, parita.giocatori.length)}: i
            giocatori sono pari in tutti i criteri. Decidi tu l&apos;ordine, la
            scelta resta nel registro con il tuo nome.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-stack-sm">
          <form
            ref={formRef}
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              onConfermaOrdine();
            }}
            className="flex flex-col gap-stack-sm"
          >
            <input type="hidden" name="tappaId" value={girone.tappaId} />
            <input type="hidden" name="categoria" value={girone.categoria} />
            <input type="hidden" name="gironeId" value={girone.gironeId} />
            <input type="hidden" name="firma" value={parita.firma} />
            {ordine.map((id) => (
              <input key={id} type="hidden" name="ordine" value={id} />
            ))}
            <input type="hidden" name="motivo" value={motivo ?? ""} />

            <CriteriPari parita={parita} />

            <section
              aria-labelledby={`${annuncioId}-titolo`}
              className="flex flex-col gap-space-2"
            >
              <h3
                id={`${annuncioId}-titolo`}
                className="font-heading font-semibold"
              >
                Ordine in classifica
              </h3>
              <Tape size={4} className="max-w-16" />
              <ol
                aria-label="Ordine dei giocatori pari"
                className="flex flex-col"
                data-testid="ordine-parita"
              >
                {ordine.map((id, i) => {
                  const nome = nomi.get(id) ?? id;
                  const spostato = id !== iniziale[i];
                  return (
                    <li key={id} className="flex flex-col">
                      <div
                        data-spostato={spostato || undefined}
                        className="flex min-h-12 items-center gap-space-3 border-2 border-primary bg-background px-space-3 py-space-2 data-spostato:shadow-[inset_0_-4px_0_var(--color-tape)]"
                      >
                        <span className="shrink-0 font-mono text-lg font-semibold tabular-nums">
                          {ordinale(parita.posizione + i)}
                        </span>
                        <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                          {nome}
                        </span>
                      </div>
                      {i < ordine.length - 1 ? (
                        <div className="flex justify-center py-space-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="campo"
                            className="max-w-full"
                            data-scambia={i}
                            aria-label={`Scambia ${nome} e ${nomi.get(ordine[i + 1]) ?? ordine[i + 1]}`}
                            disabled={pending}
                            onClick={() => onScambia(i)}
                          >
                            <ArrowUpDownIcon aria-hidden />
                            Scambia ↕
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              <p
                role="status"
                data-testid="annuncio-scambio"
                className={annuncio ? "text-sm font-semibold" : "sr-only"}
              >
                {annuncio}
              </p>
              {campi.ordine ? (
                <p className="flex items-start gap-space-2 font-semibold text-error-fg">
                  <AlertCircleIcon
                    aria-hidden
                    className="mt-1 size-4 shrink-0"
                  />
                  {campi.ordine}
                </p>
              ) : null}
            </section>

            <RadioCardGroup<MotivoParita | null>
              legend="Come è stata decisa"
              required
              value={motivo}
              onValueChange={(value) => {
                setMotivo(value);
                setCampi((c) => ({ ...c, motivo: undefined }));
              }}
              error={campi.motivo}
              disabled={pending}
            >
              {MOTIVI_PARITA.map((m) => (
                <RadioCard key={m.id} value={m.id} title={m.etichetta} />
              ))}
            </RadioCardGroup>

            <Field
              label="Dettagli"
              required={motivo === "altro"}
              hint={
                motivo === "altro"
                  ? "Scrivi come è stata decisa la parità."
                  : "Facoltativo: finisce nel registro insieme al motivo."
              }
              error={campi.note}
              disabled={pending}
            >
              <Textarea
                name="note"
                rows={3}
                maxLength={NOTE_PARITA_MAX}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (campi.note) setCampi((c) => ({ ...c, note: undefined }));
                }}
              />
            </Field>

            {avviso ? (
              <Avviso
                stato={avviso}
                da={pathname}
                onRicarica={() => {
                  setAvviso(null);
                  onOpenChange(false);
                  router.refresh();
                }}
              />
            ) : null}
            {!online ? (
              <p
                id={offlineId}
                className="flex items-start gap-space-2 font-medium"
              >
                <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {M.offline}
              </p>
            ) : null}
          </form>
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={<Button variant="secondary" className="max-w-full" />}
            disabled={pending}
          >
            Annulla
          </DialogClose>
          <Button
            variant="primary"
            className="max-w-full"
            onClick={onConfermaOrdine}
            disabled={!online}
            focusableWhenDisabled
            aria-describedby={!online ? offlineId : undefined}
          >
            Conferma l&apos;ordine
          </Button>
        </DialogFooter>

        <AlertDialog
          open={conferma}
          onOpenChange={(next) => {
            if (pending) return;
            setConferma(next);
          }}
        >
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Decidere questo ordine?</AlertDialogTitle>
              <AlertDialogDescription>
                {girone.gironeNome}:{" "}
                {cambiato || decisa
                  ? "la classifica prende questo ordine."
                  : "la classifica prende l'ordine mostrato, senza scambi."}{" "}
                {decisa ? "Sostituisce la decisione precedente. " : ""}
                La decisione va nel registro con il tuo nome.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogBody>
              <ol
                aria-label="Nuovo ordine"
                className="flex flex-col gap-space-1 border-l-4 border-tape ps-space-3"
              >
                {nomiOrdine.map((nome, i) => (
                  <li
                    key={nome + i}
                    className="flex items-baseline gap-space-2 [overflow-wrap:anywhere]"
                  >
                    <span className="font-mono font-semibold tabular-nums">
                      {ordinale(parita.posizione + i)}
                    </span>
                    {nome}
                  </li>
                ))}
              </ol>
            </AlertDialogBody>
            <AlertDialogFooter>
              <AlertDialogCancel className="max-w-full">
                Torna all&apos;ordine
              </AlertDialogCancel>
              <AlertDialogAction
                className="max-w-full"
                loading={pending}
                loadingText="Salvataggio…"
                disabled={!online}
                onClick={onDecidi}
              >
                Sì, decidi l&apos;ordine
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
