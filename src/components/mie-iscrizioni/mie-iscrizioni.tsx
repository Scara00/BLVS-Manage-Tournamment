"use client";

import { CheckCircle2Icon, CircleIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { Tape } from "@/components/scoreboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  AnnullaIscrizioneAction,
  AnnullaIscrizioneState,
} from "@/lib/iscrizioni/annullamento/state";
import type { AnnullamentoView } from "@/lib/iscrizioni/annullamento/view";
import {
  posizioneTesto,
  puntiTesto,
  type IscrizioneMia,
  type MieIscrizioniView,
  type RiepilogoStagione,
  type TonoStato,
} from "@/lib/iscrizioni/mie/mie";
import {
  iscrizioneAncora,
  MIE_ISCRIZIONI_PATH,
} from "@/lib/iscrizioni/mie/paths";
import { CLASSIFICA_PATH } from "@/lib/navigation/auth-paths";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";
import { TAPPE_PATH, tappaHref } from "@/lib/tappe/paths";
import { cn } from "@/lib/utils";
import {
  AnnullaIscrizioneDialog,
  type EsitoDialog,
} from "./annulla-iscrizione-dialog";
import {
  annullaTriggerClassName,
  ScadenzaAnnullamento,
} from "./annulla-iscrizione";
import { EsitoAnnullamento } from "./esito-annullamento";

const ESITO_ID = "mie-iscrizioni-esito";

const linkClassName =
  "font-semibold underline decoration-2 underline-offset-4 hover:decoration-4 focus-ring";

function classificaHref(stagione: number, categoria: string) {
  return `${CLASSIFICA_PATH}?categoria=${categoria}&stagione=${stagione}`;
}

/** The state in words, with an icon: never by colour alone. */
function StatoIscrizione({ testo, tono }: { testo: string; tono: TonoStato }) {
  const Icona =
    tono === "attiva"
      ? CheckCircle2Icon
      : tono === "annullata"
        ? XCircleIcon
        : CircleIcon;
  return (
    <span
      data-testid="stato-iscrizione"
      data-tono={tono}
      className={cn(
        "inline-flex items-start gap-space-2 font-semibold",
        tono === "annullata" && "text-error-fg",
      )}
    >
      <Icona aria-hidden className="mt-1 size-4 shrink-0" />
      {testo}
    </span>
  );
}

function Voce({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-space-1">
      <dt className="text-sm text-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function IscrizioneCard({
  iscrizione,
  onAnnulla,
}: {
  iscrizione: IscrizioneMia;
  onAnnulla: (annullamento: AnnullamentoView, button: HTMLElement) => void;
}) {
  const titoloId = `${iscrizioneAncora(iscrizione.id)}-titolo`;
  const scadenzaId = `${iscrizioneAncora(iscrizione.id)}-scadenza`;
  const { annullamento } = iscrizione;
  return (
    <li className="min-w-0">
      <article
        id={iscrizioneAncora(iscrizione.id)}
        aria-labelledby={titoloId}
        data-testid="iscrizione-mia"
        data-tappa={iscrizione.tappaId}
        data-stato={iscrizione.stato}
        className={cn(
          "flex h-full flex-col gap-space-3 border-2 p-inset",
          iscrizione.tono === "attiva" ? "border-primary" : "border-border",
        )}
      >
        <h3
          id={titoloId}
          className="font-heading text-xl font-semibold text-balance"
        >
          {iscrizione.apribile ? (
            <Link
              href={tappaHref(iscrizione.tappaId)}
              className={linkClassName}
            >
              {iscrizione.nome}
            </Link>
          ) : (
            iscrizione.nome
          )}
        </h3>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-space-3">
          <Voce label="Stato">
            <StatoIscrizione
              testo={iscrizione.statoTesto}
              tono={iscrizione.tono}
            />
          </Voce>
          <Voce label="Data">
            <time
              dateTime={iscrizione.dataInizio}
              className="font-mono tabular-nums"
            >
              {iscrizione.periodo}
            </time>
          </Voce>
          {iscrizione.luogo ? (
            <Voce label="Luogo">{iscrizione.luogo}</Voce>
          ) : null}
          <Voce label="Posto">
            {iscrizione.posto ? (
              <Badge
                variant="tape"
                className="font-mono tabular-nums"
                data-testid="posto"
              >
                {iscrizione.posto} · {CATEGORIA_LABEL[iscrizione.categoria]}
              </Badge>
            ) : (
              CATEGORIA_LABEL[iscrizione.categoria]
            )}
          </Voce>
          <Voce label="Tappa">{iscrizione.statoTappaTesto}</Voce>
          {iscrizione.risultatoTesto ? (
            <Voce label="Risultato">
              <span data-testid="risultato" className="font-mono tabular-nums">
                {iscrizione.risultatoTesto}
              </span>
            </Voce>
          ) : null}
        </dl>
        {annullamento ? (
          <div className="mt-auto flex flex-col items-start gap-space-2">
            <ScadenzaAnnullamento annullamento={annullamento} id={scadenzaId} />
            {annullamento.possibile ? (
              <Button
                variant="secondary"
                className={annullaTriggerClassName}
                aria-describedby={`${titoloId} ${scadenzaId}`}
                onClick={(event) =>
                  onAnnulla(annullamento, event.currentTarget)
                }
              >
                <XCircleIcon aria-hidden />
                Annulla l&apos;iscrizione
              </Button>
            ) : null}
          </div>
        ) : null}
      </article>
    </li>
  );
}

function Elenco({
  titolo,
  id,
  iscrizioni,
  vuoto,
  onAnnulla,
}: {
  titolo: string;
  id: string;
  iscrizioni: readonly IscrizioneMia[];
  vuoto: React.ReactNode;
  onAnnulla: (annullamento: AnnullamentoView, button: HTMLElement) => void;
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid={id}
      className="flex flex-col gap-stack-sm"
    >
      <h2 id={id} className="font-heading text-2xl font-semibold">
        {titolo}
      </h2>
      {iscrizioni.length > 0 ? (
        <ul className="grid grid-cols-1 gap-stack md:grid-cols-2">
          {iscrizioni.map((i) => (
            <IscrizioneCard key={i.id} iscrizione={i} onAnnulla={onAnnulla} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-space-2">{vuoto}</div>
      )}
    </section>
  );
}

function Stagione({ stagione }: { stagione: RiepilogoStagione }) {
  return (
    <section
      aria-labelledby="stagione-titolo"
      data-testid="riepilogo-stagione"
      className="flex flex-col gap-space-3 border-2 border-primary p-inset md:p-inset-lg"
    >
      <Tape size={8} className="w-24" />
      <div className="flex flex-wrap items-baseline justify-between gap-space-2">
        <h2
          id="stagione-titolo"
          className="font-heading text-2xl font-semibold"
        >
          La tua stagione {stagione.stagione}
        </h2>
        {stagione.provvisori ? (
          <Badge variant="tape">Punti provvisori</Badge>
        ) : null}
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-space-4">
        <div className="flex flex-col gap-space-1">
          <dt className="text-sm text-foreground">Punti</dt>
          <dd
            data-testid="stagione-punti"
            className="font-mono text-3xl font-semibold tabular-nums"
          >
            {stagione.punti}
          </dd>
        </div>
        <div className="flex flex-col gap-space-1">
          <dt className="text-sm text-foreground">Tappe giocate</dt>
          <dd
            data-testid="stagione-tappe"
            className="font-mono text-3xl font-semibold tabular-nums"
          >
            {stagione.tappeGiocate}
          </dd>
        </div>
        <div className="flex flex-col gap-space-1">
          <dt className="text-sm text-foreground">
            Posizione in generale · {CATEGORIA_LABEL[stagione.categoria]}
          </dt>
          <dd
            data-testid="stagione-posizione"
            className="text-xl font-semibold"
          >
            {stagione.posizione === null ? (
              "Non ancora in classifica"
            ) : (
              <>
                <span className="font-mono text-3xl tabular-nums">
                  {stagione.posizione}°
                </span>{" "}
                <span>
                  su {stagione.giocatori}
                  {stagione.pariMerito ? ", a pari merito" : ""}
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>
      <p className="sr-only">
        {stagione.posizione === null
          ? `Stagione ${stagione.stagione}: ${puntiTesto(stagione.punti)}, non ancora in classifica.`
          : `Stagione ${stagione.stagione}: ${puntiTesto(stagione.punti)}, ${posizioneTesto(stagione.posizione, stagione.pariMerito)} su ${stagione.giocatori}.`}
      </p>
      <Link
        href={classificaHref(stagione.stagione, stagione.categoria)}
        className={cn(
          linkClassName,
          "inline-flex min-h-12 items-center self-start",
        )}
      >
        Classifica generale {stagione.stagione}
      </Link>
    </section>
  );
}

/**
 * w-mie-iscrizioni: the season summary from the overall standing, then
 * upcoming and past stages with state (as text), seat and result. One
 * cancel dialog for the page (w-annulla-iscrizione): after a cancel the
 * card stays, shows «Iscrizione annullata» and loses its button, so focus
 * goes to the result message at the top.
 */
export function MieIscrizioni({
  vista,
  action,
  initialState,
  aperta = null,
}: {
  vista: MieIscrizioniView;
  action: AnnullaIscrizioneAction;
  initialState?: AnnullaIscrizioneState;
  /** Stories: the dialog open on this registration. */
  aperta?: AnnullamentoView | null;
}) {
  const [target, setTarget] = useState<AnnullamentoView | null>(aperta);
  const [message, setMessage] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const onAnnulla = useCallback(
    (annullamento: AnnullamentoView, button: HTMLElement) => {
      trigger.current = button;
      setTarget(annullamento);
    },
    [],
  );
  const onClose = useCallback((esito: EsitoDialog) => {
    setTarget(null);
    if (esito.annullata) setMessage(esito.message ?? null);
  }, []);

  return (
    <div data-testid="mie-iscrizioni" className="flex flex-col gap-stack-lg">
      <EsitoAnnullamento id={ESITO_ID} message={message} />
      {vista.stagione ? <Stagione stagione={vista.stagione} /> : null}
      <Elenco
        titolo="Prossime tappe"
        id="prossime-tappe"
        iscrizioni={vista.prossime}
        onAnnulla={onAnnulla}
        vuoto={
          <>
            <p>Non sei iscritto a nessuna tappa in programma.</p>
            <Link
              href={TAPPE_PATH}
              className={cn(linkClassName, "inline-flex min-h-12 items-center")}
            >
              Scegli una tappa
            </Link>
          </>
        }
      />
      <Elenco
        titolo="Tappe passate"
        id="tappe-passate"
        iscrizioni={vista.passate}
        onAnnulla={onAnnulla}
        vuoto={<p>Non hai ancora giocato nessuna tappa.</p>}
      />
      <AnnullaIscrizioneDialog
        target={target}
        onClose={onClose}
        returnFocus={trigger}
        esitoId={ESITO_ID}
        ritorno={MIE_ISCRIZIONI_PATH}
        action={action}
        initialState={initialState}
      />
    </div>
  );
}
