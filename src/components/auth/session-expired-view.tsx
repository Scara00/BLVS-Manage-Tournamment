import { ArrowRightIcon, CheckCircle2Icon, FileClockIcon } from "lucide-react";
import Link from "next/link";
import { ActionLink } from "@/components/error-page/action-link";
import { Tape } from "@/components/scoreboard";
import type { Draft } from "@/lib/drafts/drafts";
import { formatServerTime } from "@/lib/time/server-time";

export type SessionExpiredViewProps = {
  /** Italian name of the page to go back to («Classifica»). */
  destination: string;
  /** Its internal path, shown in mono next to the name. */
  returnPath: string;
  /** Login link that keeps the return path. */
  loginHref: string;
  /** Local drafts; `null` while they are being read (first render). */
  drafts: Draft[] | null;
};

const sectionTitle = "font-heading text-xl font-semibold";

/**
 * w-sessione-scaduta: says where the user goes back to, what is already
 * saved on the server and what is only a local draft on this device.
 */
export function SessionExpiredView({
  destination,
  returnPath,
  loginHref,
  drafts,
}: SessionExpiredViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-stack-lg px-inset py-space-6 md:py-space-8">
      <header className="flex flex-col gap-space-3">
        <p className="text-sm font-semibold tracking-wide uppercase">
          Sessione scaduta
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Per sicurezza ti abbiamo disconnesso
        </h1>
        <Tape size={8} className="max-w-24" />
        <p className="text-lg text-pretty">
          È passato troppo tempo dall&apos;ultima attività. Accedi di nuovo per
          continuare da dove eri rimasto.
        </p>
      </header>

      <section
        aria-labelledby="scaduta-dove"
        className="flex flex-col gap-space-2"
      >
        <h2 id="scaduta-dove" className={sectionTitle}>
          Dove torni
        </h2>
        <p>
          Dopo l&apos;accesso torni a{" "}
          <strong className="font-semibold">{destination}</strong>{" "}
          <code className="font-mono text-sm break-all">({returnPath})</code>.
        </p>
      </section>

      <section
        aria-labelledby="scaduta-salvato"
        className="flex flex-col gap-space-2"
      >
        <h2 id="scaduta-salvato" className={sectionTitle}>
          Cosa è salvato
        </h2>
        <p className="flex items-start gap-space-2">
          <CheckCircle2Icon
            aria-hidden
            className="mt-1 size-5 shrink-0 text-success-fg"
          />
          <span>
            Tutto quello che hai inviato e che ti è stato confermato prima della
            scadenza (iscrizioni, punteggi, modifiche ai dati) è salvato sul
            server e non va rifatto.
          </span>
        </p>
      </section>

      <section
        aria-labelledby="scaduta-bozze"
        className="flex flex-col gap-space-3"
      >
        <h2 id="scaduta-bozze" className={sectionTitle}>
          Cosa resta in bozza
        </h2>
        <DraftList drafts={drafts} />
      </section>

      <div className="flex flex-wrap gap-space-3">
        <ActionLink href={loginHref} variant="primary" className="max-w-full">
          Accedi di nuovo
          <ArrowRightIcon aria-hidden />
        </ActionLink>
      </div>
    </div>
  );
}

function DraftList({ drafts }: { drafts: Draft[] | null }) {
  if (drafts === null)
    return <p role="status">Controllo le bozze su questo dispositivo…</p>;
  if (drafts.length === 0)
    return (
      <p>
        Nessuna bozza su questo dispositivo. Se stavi compilando un modulo senza
        inviarlo, quei dati non sono stati salvati: dovrai reinserirli.
      </p>
    );
  return (
    <>
      <p>
        Questi moduli non sono stati inviati. Sono salvati solo in questo
        browser: dopo l&apos;accesso li ritrovi compilati, ma vanno ancora
        inviati.
      </p>
      <ul className="flex flex-col gap-space-2" aria-label="Bozze non inviate">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="flex flex-wrap items-baseline gap-x-space-3 gap-y-space-1 border-l-4 border-tape bg-tape-soft p-inset-sm"
          >
            <FileClockIcon
              aria-hidden
              className="size-4 shrink-0 self-center"
            />
            <Link
              href={draft.path}
              className="font-semibold underline underline-offset-4 focus-ring"
            >
              {draft.label}
            </Link>
            <span className="text-sm">
              ultima modifica{" "}
              <time dateTime={draft.savedAt} className="font-mono">
                {formatServerTime(new Date(draft.savedAt), {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
