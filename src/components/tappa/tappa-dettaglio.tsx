import Link from "next/link";
import { Tape } from "@/components/scoreboard";
import { StatoTappaBadge } from "@/components/tappe/stato-tappa-badge";
import type { TabelloneDettaglio, TappaDettaglio } from "@/lib/tappe/dettaglio";
import { FASE_LABEL } from "@/lib/tappe/format";
import { classificaTappaHref, tabelloneTappaHref } from "@/lib/tappe/paths";
import { cn } from "@/lib/utils";
import { PrendiPostoForm, type PrendiPostoAction } from "./prendi-posto-form";

/** Stages whose boards have a stage standing to show (BLVS-49). */
const CON_CLASSIFICA: readonly TappaDettaglio["stato"][] = [
  "in_corso",
  "conclusa",
  "archiviata",
];

function Tabellone({
  tabellone,
  classificaHref,
}: {
  tabellone: TabelloneDettaglio;
  /** w-classifica-tappa of this board, once the stage has started. */
  classificaHref?: string;
}) {
  const titleId = `tabellone-${tabellone.categoria}`;
  return (
    <section
      aria-labelledby={titleId}
      data-categoria={tabellone.categoria}
      data-tuo={tabellone.tuo || undefined}
      className={cn(
        "flex flex-col gap-space-3 border-2 p-inset",
        tabellone.tuo ? "border-primary" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-space-2">
        <h3 id={titleId} className="font-heading text-xl font-semibold">
          {tabellone.label}
        </h3>
        {tabellone.tuo ? (
          <span className="bg-tape px-space-2 py-space-1 text-xs font-semibold tracking-wide text-primary uppercase">
            La tua categoria
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-space-3">
        <div className="flex flex-col gap-space-1">
          <dt className="text-sm text-muted-foreground">Stato</dt>
          <dd className="font-medium">{tabellone.statoTesto}</dd>
        </div>
        <div className="flex flex-col gap-space-1">
          <dt className="text-sm text-muted-foreground">Posti</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums">
            {tabellone.postiTesto}
          </dd>
        </div>
        {tabellone.fase ? (
          <div className="flex flex-col gap-space-1">
            <dt className="text-sm text-muted-foreground">Fase</dt>
            <dd className="font-medium">{FASE_LABEL[tabellone.fase]}</dd>
          </div>
        ) : null}
      </dl>
      {classificaHref ? (
        <Link
          href={classificaHref}
          className="inline-flex min-h-12 items-center self-start font-semibold underline decoration-2 underline-offset-4 focus-ring"
        >
          Classifica di tappa
          <span className="sr-only"> · {tabellone.label}</span>
        </Link>
      ) : null}
    </section>
  );
}

function Riga({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-space-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

/**
 * w-tappa: the stage with its two boards (state and seats), the player's
 * board, programme and phase, and «Prendi il posto N». The page passes the
 * server action, so stories can pass a stub.
 */
export function TappaDettaglioView({
  tappa,
  action,
}: {
  tappa: TappaDettaglio;
  action: PrendiPostoAction;
}) {
  return (
    <article
      aria-labelledby="tappa-titolo"
      data-testid="tappa-dettaglio"
      data-stato={tappa.stato}
      className="flex flex-col gap-stack-lg"
    >
      <header className="flex flex-col gap-space-3">
        <Tape size={8} className="w-24" />
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Circuito · Tappa
        </p>
        <h1
          id="tappa-titolo"
          className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl"
        >
          {tappa.nome}
        </h1>
        <div className="flex flex-wrap items-center gap-space-3">
          <StatoTappaBadge stato={tappa.stato} />
          {tappa.fase ? (
            <span className="font-medium">Fase: {FASE_LABEL[tappa.fase]}</span>
          ) : null}
          {tappa.stato === "in_corso" ||
          tappa.stato === "conclusa" ||
          tappa.stato === "archiviata" ? (
            <Link
              href={tabelloneTappaHref(tappa.id)}
              className="font-heading font-semibold underline decoration-2 underline-offset-4 hover:decoration-4"
            >
              Gironi e fasi
            </Link>
          ) : null}
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-space-4">
          <Riga label="Data">
            <span className="font-mono tabular-nums">{tappa.periodo}</span>
          </Riga>
          <Riga label="Luogo">{tappa.luogo}</Riga>
          <Riga label="Scadenza iscrizioni">
            {tappa.scadenza && tappa.scadenzaIso ? (
              <time
                dateTime={tappa.scadenzaIso}
                className="font-mono tabular-nums"
              >
                {tappa.scadenza}
              </time>
            ) : (
              "Nessuna scadenza"
            )}
          </Riga>
          {tappa.ritrovo ? (
            <Riga label="Ritrovo">
              {tappa.ritrovo}
              {tappa.ritrovoAlle ? `, ${tappa.ritrovoAlle}` : ""}
            </Riga>
          ) : null}
        </dl>
      </header>

      <section
        aria-labelledby="iscrizione-titolo"
        className="flex flex-col gap-stack-sm"
      >
        <h2
          id="iscrizione-titolo"
          className="font-heading text-2xl font-semibold"
        >
          Iscrizione
        </h2>
        {tappa.iscrizione &&
        tappa.motivo === "gia_iscritto" &&
        tappa.iscrizione.posto ? (
          <p className="text-lg">
            Hai il posto{" "}
            <span className="font-mono font-semibold tabular-nums">
              {tappa.iscrizione.posto}
            </span>{" "}
            in questa tappa.
          </p>
        ) : null}
        <PrendiPostoForm tappa={tappa} action={action} />
      </section>

      <section
        aria-labelledby="tabelloni-titolo"
        className="flex flex-col gap-stack-sm"
      >
        <h2
          id="tabelloni-titolo"
          className="font-heading text-2xl font-semibold"
        >
          Tabelloni
        </h2>
        <div className="grid gap-stack md:grid-cols-2">
          {tappa.tabelloni.map((t) => (
            <Tabellone
              key={t.categoria}
              tabellone={t}
              classificaHref={
                CON_CLASSIFICA.includes(tappa.stato)
                  ? classificaTappaHref(tappa.id, t.categoria)
                  : undefined
              }
            />
          ))}
        </div>
      </section>

      <section
        aria-labelledby="programma-titolo"
        className="flex flex-col gap-stack-sm"
      >
        <h2
          id="programma-titolo"
          className="font-heading text-2xl font-semibold"
        >
          Programma
        </h2>
        {tappa.programma ? (
          <p className="max-w-prose whitespace-pre-line">{tappa.programma}</p>
        ) : (
          <p className="text-muted-foreground">
            Il programma sarà pubblicato a breve.
          </p>
        )}
      </section>
    </article>
  );
}
