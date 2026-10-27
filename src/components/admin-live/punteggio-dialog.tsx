"use client";

import { AlertCircleIcon, PencilLineIcon } from "lucide-react";
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
  const [state, formAction, pending] = useActionState(
    safeAction,
    initialAzionePartitaState,
  );

  const [visto, setVisto] = useState(state);
  if (state !== visto) {
    setVisto(state);
    if (state.status !== "idle" && state.status !== "fieldErrors") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (state.status === "idle") return;
    if (state.status === "fieldErrors") {
      if (formRef.current) focusFirstInvalid(formRef.current);
      return;
    }
    onEsito(state);
  }, [state, onEsito]);

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
        if (next) setNelDialog(partita);
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
            {nelDialog.stato === "in_corso" ? (
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
              Salva
            </DialogAction>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
