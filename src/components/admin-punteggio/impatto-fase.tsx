"use client";

import { AlertCircleIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ComponentProps } from "react";
import { Tape } from "@/components/scoreboard";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Fieldset, focusFirstInvalid } from "@/components/ui/field";
import {
  avvisoPerdita,
  descriviPartitaSuccessiva,
  descriviSets,
  descriviSquadra,
  erroreConferma,
  etichettaConferma,
  riepilogoImpatto,
} from "@/lib/punteggi/correzione/format";
import type {
  ImpattoFase as ImpattoFaseValore,
  PartitaFaseSuccessiva,
  SceltaImpatto,
} from "@/lib/punteggi/correzione/types";
import { PUNTEGGIO_MESSAGES } from "@/lib/punteggi/state";

type ImpattoFaseProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impatto: ImpattoFaseValore;
  /** «Rigenera» refused by the server without the tick. */
  erroreConferma?: string | null;
  /** The next phase changed while the dialog was open. */
  avviso?: string | null;
  /** A failed request (network, session): shown inside the dialog. */
  errore?: string | null;
  pending: boolean;
  online: boolean;
  /** Which choice is in flight, for the loading button. */
  inCorso?: SceltaImpatto | null;
  onScegli: (scelta: SceltaImpatto, conferma: boolean) => void;
  finalFocus?: ComponentProps<typeof AlertDialogContent>["finalFocus"];
};

function descrizione(p: PartitaFaseSuccessiva) {
  const punteggio = p.sets.length > 0 ? descriviSets(p.sets) : "da giocare";
  return `${descriviPartitaSuccessiva(p)}: ${descriviSquadra(p.squadre.a)} contro ${descriviSquadra(p.squadre.b)}, ${punteggio}`;
}

function Anteprima({ partite }: { partite: PartitaFaseSuccessiva[] }) {
  return (
    <ul
      aria-label="Partite della fase successiva"
      data-testid="anteprima-fase"
      className="flex flex-col border-2 border-primary"
    >
      {partite.map((p) => (
        <li
          key={p.id}
          aria-label={descrizione(p)}
          data-con-punteggio={p.sets.length > 0 || undefined}
          className="flex flex-col gap-space-1 border-b border-border p-space-3 [overflow-wrap:anywhere] last:border-b-0"
        >
          <span aria-hidden className="font-heading font-semibold">
            {descriviPartitaSuccessiva(p)}
          </span>
          <span aria-hidden className="text-sm">
            {descriviSquadra(p.squadre.a)} <span>contro</span>{" "}
            {descriviSquadra(p.squadre.b)}
          </span>
          <span
            aria-hidden
            className={
              p.sets.length > 0
                ? "self-start bg-error-bg font-mono font-semibold text-error-fg"
                : "font-mono"
            }
          >
            {p.sets.length > 0 ? descriviSets(p.sets) : "da giocare"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * w-admin-impatto-fase: a group score is being corrected but the board's
 * next phase is already generated. «Mantieni» keeps it as it is (the
 * registro notes it); «Rigenera» deletes it so it is generated again from
 * the corrected standings, losing its scores: then the box inside its card
 * must be ticked. Without the tick the error appears next to the box,
 * which takes focus. The footer sits outside the scrolling body, so the
 * choices are always visible.
 */
export function ImpattoFase({
  open,
  onOpenChange,
  impatto,
  erroreConferma: erroreServer = null,
  avviso = null,
  errore = null,
  pending,
  online,
  inCorso = null,
  onScegli,
  finalFocus,
}: ImpattoFaseProps) {
  const ids = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const persi = impatto.punteggiPersi;
  // BLVS-43: on a concluded board only «Mantieni», confirmed explicitly.
  const concluso = impatto.tabelloneConcluso === true;
  const [spuntata, setSpuntata] = useState(false);
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  /** Bumped on every refused «Rigenera», to move focus each time. */
  const [tentativi, setTentativi] = useState(0);

  // A new count from the server (the phase changed): tick again.
  const [visto, setVisto] = useState(impatto);
  if (impatto !== visto) {
    setVisto(impatto);
    if (impatto.punteggiPersi !== visto.punteggiPersi) setSpuntata(false);
  }
  const [erroreVisto, setErroreVisto] = useState(erroreServer);
  if (erroreServer !== erroreVisto) {
    setErroreVisto(erroreServer);
    if (erroreServer) {
      setErroreLocale(erroreServer);
      setTentativi((n) => n + 1);
    }
  }

  useEffect(() => {
    if (tentativi === 0) return;
    requestAnimationFrame(() => {
      if (formRef.current) focusFirstInvalid(formRef.current);
    });
  }, [tentativi]);

  const rigenera = () => {
    if (pending || !online || concluso) return;
    if (persi > 0 && !spuntata) {
      setErroreLocale(erroreConferma(persi));
      setTentativi((n) => n + 1);
      return;
    }
    onScegli("rigenera", spuntata);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          setSpuntata(false);
          setErroreLocale(null);
        }
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        className="max-w-xl"
        data-testid="impatto-fase"
        finalFocus={finalFocus}
      >
        <form
          ref={formRef}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            rigenera();
          }}
          className="contents"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {concluso
                ? "Il tabellone è concluso"
                : "La fase successiva è già generata"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {concluso
                ? "I punti della tappa sono definitivi. La correzione mantiene le finali com'erano: confermala in modo esplicito."
                : `${riepilogoImpatto(impatto)} Scegli se mantenerla com'è o rigenerarla dalla classifica corretta.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogBody className="flex flex-col gap-stack-sm">
            <Tape size={8} />
            {avviso ? (
              <p
                role="alert"
                className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-space-3 font-semibold text-error-fg"
              >
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {avviso}
              </p>
            ) : null}
            {errore ? (
              <p
                role="alert"
                data-testid="errore-impatto"
                className="flex items-start gap-space-2 border-2 border-error-fg bg-error-bg p-space-3 font-semibold text-error-fg"
              >
                <AlertCircleIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {errore}
              </p>
            ) : null}
            <h3 className="font-heading font-semibold">Anteprima della fase</h3>
            <Anteprima partite={impatto.partite} />

            <section
              aria-labelledby={`${ids}-mantieni`}
              data-testid="card-mantieni"
              className="flex flex-col gap-space-2 border-2 border-primary p-space-3"
            >
              <h3 id={`${ids}-mantieni`} className="font-heading font-semibold">
                Mantieni
              </h3>
              <p>
                La fase successiva resta com&apos;è, con i suoi punteggi. Il
                registro annota che è stata mantenuta dopo la correzione.
              </p>
              {concluso ? (
                <p className="font-semibold" data-testid="punti-che-cambiano">
                  Punti che cambiano: nessuno. Le finali restano com&apos;erano,
                  quindi i punti della tappa restano gli stessi.
                </p>
              ) : null}
            </section>

            {concluso ? null : (
              <section
                aria-labelledby={`${ids}-rigenera`}
                data-testid="card-rigenera"
                className="flex flex-col gap-space-2 border-2 border-error-fg p-space-3"
              >
                <h3
                  id={`${ids}-rigenera`}
                  className="font-heading font-semibold"
                >
                  Rigenera
                </h3>
                <p>
                  Le partite della fase successiva vengono eliminate e si
                  generano di nuovo dalla classifica corretta.
                </p>
                <p className="flex items-start gap-space-2 font-semibold text-error-fg">
                  <AlertCircleIcon
                    aria-hidden
                    className="mt-1 size-4 shrink-0"
                  />
                  <span data-testid="punteggi-persi">
                    {avvisoPerdita(persi)}
                  </span>
                </p>
                {persi > 0 ? (
                  <Fieldset
                    legend="Conferma"
                    required
                    error={erroreLocale ?? undefined}
                  >
                    <Checkbox
                      label={etichettaConferma(persi)}
                      checked={spuntata}
                      onCheckedChange={(checked) => {
                        setSpuntata(checked);
                        if (checked) setErroreLocale(null);
                      }}
                    />
                  </Fieldset>
                ) : null}
              </section>
            )}

            {!online ? (
              <p
                id={`${ids}-offline`}
                className="flex items-start gap-space-2 font-medium"
              >
                <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
                {PUNTEGGIO_MESSAGES.offline}
              </p>
            ) : null}
          </AlertDialogBody>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-w-full" disabled={pending}>
              Annulla
            </AlertDialogCancel>
            <Button
              type="button"
              variant="secondary"
              className="max-w-full"
              loading={pending && inCorso === "mantieni"}
              disabled={!online || (pending && inCorso !== "mantieni")}
              aria-describedby={!online ? `${ids}-offline` : undefined}
              onClick={() => {
                if (pending || !online) return;
                onScegli("mantieni", concluso);
              }}
            >
              {concluso ? "Sì, correggi e mantieni" : "Mantieni"}
            </Button>
            {concluso ? null : (
              <Button
                type="submit"
                variant="destructive"
                className="max-w-full"
                loading={pending && inCorso === "rigenera"}
                disabled={!online || (pending && inCorso !== "rigenera")}
                aria-describedby={!online ? `${ids}-offline` : undefined}
              >
                Rigenera
              </Button>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
