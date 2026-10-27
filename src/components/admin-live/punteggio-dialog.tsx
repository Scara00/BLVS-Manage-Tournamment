"use client";

import { AlertCircleIcon, PencilLineIcon } from "lucide-react";
import { Tape } from "@/components/scoreboard";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, focusFirstInvalid } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Categoria } from "@/lib/db/types";
import { descriviCambio, riepilogoCambi } from "@/lib/tappe/chiusura/format";
import { CATEGORIA_SEGMENTO } from "@/lib/tappe/avvio/paths";
import { descriviPartita, squadraLabel } from "@/lib/tappe/live-admin/format";
import { campoSet, SET_MASSIMI } from "@/lib/tappe/live-admin/punteggio";
import {
  initialAzionePartitaState,
  LIVE_ADMIN_MESSAGES,
  type AzionePartitaAction,
  type AzionePartitaState,
} from "@/lib/tappe/live-admin/state";
import type { PartitaLive } from "@/lib/tappe/live-admin/types";

type PunteggioDialogProps = {
  partita: PartitaLive;
  tappaId: string;
  categoria: Categoria;
  /** The `salvaPunteggio` server action (a fake in Storybook). */
  action: AzionePartitaAction;
  disabled?: boolean;
  /** Points at the offline notice while `disabled`. */
  describedBy?: string;
  /** Every outcome but field errors goes to the page's message area. */
  onEsito: (state: AzionePartitaState) => void;
  /** Storybook/axe: open at once. */
  defaultOpen?: boolean;
  /** Storybook/axe: the action's first answer. */
  initialState?: AzionePartitaState;
};

/**
 * «Inserisci punteggio» / «Correggi punteggio»: up to three sets, saved
 * with the version read (another admin's save in between is a conflict).
 * From a match in progress, «Salva e concludi» closes it too.
 */
export function PunteggioDialog({
  partita,
  tappaId,
  categoria,
  action,
  disabled = false,
  describedBy,
  onEsito,
  defaultOpen = false,
  initialState = initialAzionePartitaState,
}: PunteggioDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  // The dialog keeps the match it was opened for while it fades out, even
  // if a live update or a refresh changes it underneath.
  const [nelDialog, setNelDialog] = useState(partita);
  const [concludendo, setConcludendo] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const safeAction = useCallback<AzionePartitaAction>(
    async (prev, formData) => {
      try {
        return await action(prev, formData);
      } catch (error) {
        console.error("[admin-live] richiesta non riuscita", error);
        return {
          status: "error",
          reason: "network",
          message: LIVE_ADMIN_MESSAGES.network,
          at: prev.status === "idle" ? 1 : prev.at + 1,
        };
      }
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(safeAction, initialState);
  // BLVS-43: the board is concluded and the server listed what changes.
  const [inConferma, setInConferma] = useState(
    initialState.status === "confermaConcluso",
  );
  const confermaRef = useRef<HTMLHeadingElement>(null);

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    setInConferma(state.status === "confermaConcluso");
    if (
      state.status !== "idle" &&
      state.status !== "fieldErrors" &&
      state.status !== "confermaConcluso"
    ) {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "fieldErrors") {
      if (formRef.current) focusFirstInvalid(formRef.current);
      return;
    }
    if (state.status === "confermaConcluso") {
      confermaRef.current?.focus({ preventScroll: true });
      confermaRef.current?.scrollIntoView?.({ block: "nearest" });
      return;
    }
    onEsito(state);
  }, [state, onEsito]);

  const conferma =
    inConferma && state.status === "confermaConcluso" ? state : null;

  const conclusa = partita.stato === "conclusa";
  const verbo = conclusa ? "Correggi punteggio" : "Inserisci punteggio";
  const descrizione = descriviPartita(nelDialog);
  const errori = state.status === "fieldErrors" ? state.errori : {};
  const squadraA = squadraLabel(nelDialog.squadraA);
  const squadraB = squadraLabel(nelDialog.squadraB);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    setConcludendo(formData.get("concludi") === "1");
    // Not `<form action>`: React would reset the typed points on errors.
    startTransition(() => formAction(formData));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setNelDialog(partita);
          setInConferma(false);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant={conclusa ? "secondary" : "primary"}
            size="campo"
            className="max-w-full"
            disabled={disabled}
            focusableWhenDisabled={disabled}
            aria-describedby={describedBy}
            aria-label={`${verbo}: ${descriviPartita(partita)}`}
          />
        }
      >
        <PencilLineIcon aria-hidden />
        {verbo}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form
          ref={formRef}
          onSubmit={onSubmit}
          noValidate
          className="flex min-h-0 flex-col gap-stack"
          data-testid="punteggio-form"
        >
          <input type="hidden" name="tappaId" value={tappaId} />
          <input
            type="hidden"
            name="categoria"
            value={CATEGORIA_SEGMENTO[categoria]}
          />
          <input type="hidden" name="partitaId" value={nelDialog.id} />
          <input type="hidden" name="versione" value={nelDialog.versione} />
          {conferma ? (
            <>
              <input type="hidden" name="conferma" value="1" />
              <input type="hidden" name="firma" value={conferma.firma} />
            </>
          ) : null}
          <DialogHeader>
            <DialogTitle>
              {nelDialog.stato === "conclusa" ? "Correggi" : "Inserisci"} il
              punteggio · {descrizione}
            </DialogTitle>
            <DialogDescription>
              {squadraA} contro {squadraB}. Scrivi i punti di ogni set giocato;
              lascia vuoti i set non giocati.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-stack">
            {conferma ? (
              <section
                aria-labelledby={`${nelDialog.id}-conferma`}
                data-testid="conferma-concluso"
                className="flex flex-col gap-space-3 border-2 border-primary p-space-3"
              >
                <h3
                  id={`${nelDialog.id}-conferma`}
                  ref={confermaRef}
                  tabIndex={-1}
                  className="font-heading text-lg font-semibold focus-ring"
                >
                  Tabellone concluso: confermi la correzione?
                </h3>
                <Tape size={4} className="max-w-16" />
                {conferma.avviso ? (
                  <p
                    role="alert"
                    className="flex items-start gap-space-2 font-semibold text-error-fg"
                  >
                    <AlertCircleIcon
                      aria-hidden
                      className="mt-1 size-4 shrink-0"
                    />
                    {conferma.avviso}
                  </p>
                ) : null}
                <p>
                  I punti di questo tabellone sono definitivi. Con la correzione
                  restano definitivi, ricalcolati così.{" "}
                  <strong>{riepilogoCambi(conferma.cambi)}</strong>
                </p>
                {conferma.cambi.length > 0 ? (
                  <ul
                    aria-label="Punti che cambiano"
                    data-testid="punti-che-cambiano"
                    className="flex flex-col border-2 border-primary"
                  >
                    {conferma.cambi.map((c) => (
                      <li
                        key={c.iscrizioneId}
                        className="border-b border-border p-space-3 font-mono [overflow-wrap:anywhere] last:border-b-0"
                      >
                        {descriviCambio(c)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="campo"
                  className="max-w-full self-start"
                  disabled={pending}
                  onClick={() => setInConferma(false)}
                >
                  Modifica i valori
                </Button>
              </section>
            ) : null}
            {errori.sets ? (
              <p
                role="alert"
                className="flex items-start gap-space-2 font-semibold text-error-fg"
              >
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errori.sets}
              </p>
            ) : null}
            {Array.from({ length: SET_MASSIMI }, (_, i) => {
              const n = i + 1;
              const set = nelDialog.sets[i];
              const errore = errori[`set${n}`];
              const erroreId = `${nelDialog.id}-set${n}-errore`;
              // One message for the set, linked to both inputs.
              const invalido = errore
                ? { "aria-invalid": true, "aria-describedby": erroreId }
                : {};
              return (
                <fieldset
                  key={n}
                  data-slot="fieldset"
                  className="m-0 flex min-w-0 flex-col gap-space-2 p-0"
                >
                  <legend className="mb-space-2 p-0 font-heading text-lg font-semibold">
                    Set {n}
                  </legend>
                  <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
                    <Field label={squadraA} size="campo">
                      <Input
                        name={campoSet(n, "a")}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={2}
                        defaultValue={set ? String(set.a) : ""}
                        readOnly={conferma !== null}
                        className="font-mono"
                        {...invalido}
                      />
                    </Field>
                    <Field label={squadraB} size="campo">
                      <Input
                        name={campoSet(n, "b")}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={2}
                        defaultValue={set ? String(set.b) : ""}
                        readOnly={conferma !== null}
                        className="font-mono"
                        {...invalido}
                      />
                    </Field>
                  </div>
                  {errore ? (
                    <FieldError id={erroreId}>{errore}</FieldError>
                  ) : null}
                </fieldset>
              );
            })}
          </DialogBody>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="secondary"
                  size="campo"
                  className="max-w-full"
                />
              }
            >
              Annulla
            </DialogClose>
            {nelDialog.stato === "in_corso" && !conferma ? (
              <DialogAction
                type="submit"
                name="concludi"
                value="1"
                variant="secondary"
                size="campo"
                className="max-w-full"
                loading={pending && concludendo}
                loadingText="Salvataggio…"
              >
                Salva e concludi
              </DialogAction>
            ) : null}
            <DialogAction
              type="submit"
              size="campo"
              className="max-w-full"
              loading={pending && !concludendo}
              loadingText="Salvataggio…"
            >
              {conferma ? "Sì, correggi il punteggio" : "Salva"}
            </DialogAction>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
