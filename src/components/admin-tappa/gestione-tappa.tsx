import { ArrowLeftIcon, PencilIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AvvioFaseLinks } from "@/components/admin-avvio-fase/avvio-fase-links";
import { Tape } from "@/components/scoreboard";
import { buttonVariants } from "@/components/ui/button";
import { iscrittiPath } from "@/lib/iscrizioni/admin/paths";
import type { GestioneTappaView } from "@/lib/tappe/gestione-format";
import {
  STATI_NON_MODIFICABILI,
  tappaModificaPath,
} from "@/lib/tappe/modifica/types";
import type {
  CambioStatoAction,
  CambioStatoState,
  ScadenzaAction,
} from "@/lib/tappe/gestione-state";
import { CambioStato } from "./cambio-stato";
import { ScadenzaForm } from "./scadenza-form";
import { ScadenzaIscrizioni } from "./scadenza-iscrizioni";
import { StatoTappaBadge } from "./stato-badge";
import { StatoFlusso } from "./stato-flusso";
import { TabelloniRiepilogo } from "./tabelloni-riepilogo";

export const ADMIN_TAPPE_PATH = "/admin/tappe";

type GestioneTappaProps = {
  tappa: GestioneTappaView;
  /** Server actions, passed in by the page (fakes in Storybook). */
  cambiaStato: CambioStatoAction;
  aggiornaScadenza: ScadenzaAction;
  /** Storybook: open the confirmation, force offline, starting state. */
  dialogAperto?: boolean;
  offline?: boolean;
  statoIniziale?: CambioStatoState;
};

function Sezione({
  id,
  titolo,
  children,
}: {
  id: string;
  titolo: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-stack-sm">
      <div className="flex flex-col gap-space-2">
        <h2 id={id} className="font-heading text-xl font-semibold">
          {titolo}
        </h2>
        <Tape size={4} className="max-w-24" />
      </div>
      {children}
    </section>
  );
}

/**
 * w-admin-tappa: the stage data, the bozza › aperte › chiuse flow with the
 * next step behind a confirmation, the deadline (and its automatic close)
 * and, per board, registrations and phase.
 */
export function GestioneTappa({
  tappa,
  cambiaStato,
  aggiornaScadenza,
  dialogAperto,
  offline,
  statoIniziale,
}: GestioneTappaProps) {
  return (
    <div className="flex flex-col gap-stack-lg" data-testid="gestione-tappa">
      <section
        aria-labelledby="tappa-nome"
        className="flex flex-col gap-stack-sm"
      >
        <h2
          id="tappa-nome"
          className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
        >
          {tappa.nome}
        </h2>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-stack-sm">
          <div className="flex flex-col gap-space-1">
            <dt className="text-sm font-medium text-muted-foreground">Luogo</dt>
            <dd className="[overflow-wrap:anywhere]">{tappa.luogo}</dd>
          </div>
          <div className="flex flex-col gap-space-1">
            <dt className="text-sm font-medium text-muted-foreground">Date</dt>
            <dd>{tappa.periodo}</dd>
          </div>
          <div className="flex flex-col items-start gap-space-1">
            <dt className="text-sm font-medium text-muted-foreground">Stato</dt>
            <dd>
              <StatoTappaBadge stato={tappa.stato} />
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-space-3">
          {STATI_NON_MODIFICABILI.includes(tappa.stato) ? null : (
            <Link
              href={tappaModificaPath(tappa.id)}
              className={buttonVariants({
                variant: "secondary",
                className: "max-w-full",
              })}
            >
              <PencilIcon aria-hidden className="size-4" />
              Modifica dati
            </Link>
          )}
          <Link
            href={iscrittiPath(tappa.id)}
            className={buttonVariants({
              variant: "secondary",
              className: "max-w-full",
            })}
          >
            <UsersIcon aria-hidden className="size-4" />
            Gestisci iscritti
          </Link>
        </div>
      </section>

      <div className="flex flex-col gap-stack">
        <StatoFlusso flusso={tappa.flusso} nota={tappa.notaStato} />
        <CambioStato
          tappaId={tappa.id}
          transizione={tappa.transizione}
          action={cambiaStato}
          defaultOpen={dialogAperto}
          offline={offline}
          initialState={statoIniziale}
        />
      </div>

      <Sezione id="scadenza-titolo" titolo="Scadenza e chiusura automatica">
        <ScadenzaIscrizioni scadenza={tappa.scadenza} />
        {tappa.scadenzaModificabile ? (
          <ScadenzaForm
            tappaId={tappa.id}
            valore={tappa.scadenzaInput}
            action={aggiornaScadenza}
            offline={offline}
          />
        ) : null}
      </Sezione>

      <TabelloniRiepilogo tabelloni={tappa.tabelloni} />

      <AvvioFaseLinks
        tappaId={tappa.id}
        stato={tappa.stato}
        tabelloni={tappa.tabelloni}
      />

      <Link
        href={ADMIN_TAPPE_PATH}
        className="inline-flex items-center gap-space-2 self-start font-heading font-semibold underline decoration-2 underline-offset-4 focus-ring"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Tutte le tappe
      </Link>
    </div>
  );
}
