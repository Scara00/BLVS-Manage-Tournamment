import {
  AlertCircleIcon,
  MedalIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { FaseGioco } from "@/lib/db/types";
import { loginHref } from "@/lib/navigation/auth-paths";
import { REGOLE_ANCORE, REGOLE_PATH } from "@/lib/regole/paths";
import {
  TESTO_UN_SET,
  introPunti,
  regoleDelCircuito,
  type PassoFormato,
  type RegoleCircuito,
  type RigaPunti,
} from "@/lib/regole/regole";

/** The «da confermare» label of an open rule (R-46): text on color.tape. */
export function DaConfermare() {
  return (
    <Badge variant="tape" data-da-confermare="">
      da confermare
    </Badge>
  );
}

/** One pictogram per step, all on the same scale. */
const PITTOGRAMMI: Record<FaseGioco, typeof UsersIcon> = {
  gironi_iniziali: UsersIcon,
  gironi_gold_silver: MedalIcon,
  finali: TrophyIcon,
};

export function PassiFormato({ passi }: { passi: readonly PassoFormato[] }) {
  return (
    <ol className="grid gap-stack md:grid-cols-3">
      {passi.map((passo) => {
        const Icona = PITTOGRAMMI[passo.id];
        return (
          <li
            key={passo.id}
            data-passo={passo.id}
            className="flex min-w-0 flex-col gap-space-3 border border-border p-inset"
          >
            <div className="flex items-center gap-space-3">
              <span className="flex size-14 shrink-0 items-center justify-center bg-tape text-primary">
                <Icona aria-hidden className="size-8" strokeWidth={1.75} />
              </span>
              <h3 className="min-w-0 font-heading text-lg font-semibold break-words">
                <span className="font-mono">Passo {passo.numero}</span>
                <span aria-hidden> · </span>
                <span className="sr-only">: </span>
                {passo.titolo}
              </h3>
            </div>
            <p className="text-pretty">{passo.testo}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function CriteriSpareggio({ testi }: { testi: readonly string[] }) {
  return (
    <ol className="flex max-w-prose list-decimal flex-col gap-space-2 ps-space-5 marker:font-mono">
      {testi.map((testo) => (
        <li key={testo} className="text-pretty">
          {testo}
        </li>
      ))}
    </ol>
  );
}

const colonnePunti: ResponsiveTableColumn<RigaPunti>[] = [
  {
    key: "posizione",
    header: "Posizione in finale",
    numeric: true,
    align: "start",
    render: (r) => `${r.posizione}°`,
  },
  { key: "gold", header: "Finale Gold", numeric: true },
  { key: "silver", header: "Finale Silver", numeric: true },
];

export function TabellaPunti({ righe }: { righe: readonly RigaPunti[] }) {
  return (
    <ResponsiveTable
      caption="Punti di tappa per posizione in finale"
      columns={colonnePunti}
      rows={righe}
      getRowKey={(r) => String(r.posizione)}
      cardTitleKey="posizione"
    />
  );
}

function SezioneRegole({
  id,
  titolo,
  aperta,
  children,
}: {
  id: string;
  titolo: string;
  aperta: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titolo`}
      className="flex scroll-mt-space-8 flex-col gap-stack"
    >
      <div className="flex flex-wrap items-center gap-x-space-3 gap-y-space-2">
        <h2
          id={`${id}-titolo`}
          className="font-heading text-2xl font-semibold break-words"
        >
          {titolo}
        </h2>
        {aperta ? <DaConfermare /> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Banner of an expired session: the page is public, so the rules stay
 * readable below it.
 */
export function RegoleSessioneScaduta() {
  return (
    <section
      aria-labelledby="regole-sessione-titolo"
      className="flex max-w-2xl flex-col items-start gap-space-3 border-2 border-error-fg bg-error-bg p-inset text-error-fg md:p-inset-lg"
    >
      <h2
        id="regole-sessione-titolo"
        className="flex items-start gap-space-2 font-heading text-xl font-semibold"
      >
        <AlertCircleIcon aria-hidden className="mt-1 size-5 shrink-0" />
        Sessione scaduta
      </h2>
      <p>
        Le regole restano consultabili. Accedi di nuovo per vedere le tue tappe
        e la tua posizione.
      </p>
      <Link
        href={loginHref(REGOLE_PATH, { reason: "scaduta" })}
        className={buttonVariants({
          variant: "primary",
          className: "max-w-full",
        })}
      >
        Accedi di nuovo
      </Link>
    </section>
  );
}

/** w-regole body (BLVS-46): every text comes from the configuration. */
export function Regole({
  regole = regoleDelCircuito(),
  sessioneScaduta = false,
}: {
  regole?: RegoleCircuito;
  sessioneScaduta?: boolean;
}) {
  const aperte = [
    regole.formato,
    regole.set,
    regole.spareggiGirone,
    regole.punti,
    regole.spareggiGenerale,
  ].some((s) => s.daConfermare);
  return (
    <div className="flex flex-col gap-stack-lg">
      {sessioneScaduta ? <RegoleSessioneScaduta /> : null}
      {aperte ? (
        <p className="flex max-w-prose flex-wrap items-center gap-x-space-2 gap-y-space-1">
          <DaConfermare />
          <span>
            Alcune regole sono provvisorie: l&apos;organizzazione le sta ancora
            confermando e potrebbero cambiare.
          </span>
        </p>
      ) : null}

      <SezioneRegole
        id={REGOLE_ANCORE.formato}
        titolo="Il formato della tappa"
        aperta={regole.formato.daConfermare}
      >
        <PassiFormato passi={regole.formato.contenuto} />
      </SezioneRegole>

      <SezioneRegole
        id={REGOLE_ANCORE.set}
        titolo="Il set"
        aperta={regole.set.daConfermare}
      >
        <p className="max-w-prose text-pretty">
          {TESTO_UN_SET} {regole.set.contenuto}
        </p>
      </SezioneRegole>

      <SezioneRegole
        id={REGOLE_ANCORE.spareggiGirone}
        titolo="Classifica del girone e spareggi"
        aperta={regole.spareggiGirone.daConfermare}
      >
        <CriteriSpareggio testi={regole.spareggiGirone.contenuto} />
      </SezioneRegole>

      <SezioneRegole
        id={REGOLE_ANCORE.punti}
        titolo="Punti di tappa"
        aperta={regole.punti.daConfermare}
      >
        <p className="max-w-prose text-pretty">
          {introPunti(regole.punti.contenuto)}
        </p>
        <TabellaPunti righe={regole.punti.contenuto} />
      </SezioneRegole>

      <SezioneRegole
        id={REGOLE_ANCORE.spareggiGenerale}
        titolo="Classifica generale e spareggi"
        aperta={regole.spareggiGenerale.daConfermare}
      >
        <CriteriSpareggio testi={regole.spareggiGenerale.contenuto} />
      </SezioneRegole>
    </div>
  );
}
