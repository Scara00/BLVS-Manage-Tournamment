import Link from "next/link";
import { Tape } from "@/components/scoreboard";
import { StatoTappaBadge } from "@/components/tappe/stato-tappa-badge";
import { buttonVariants } from "@/components/ui/button";
import type { HomeProssima as HomeProssimaData } from "@/lib/home/types";
import { iscrizioneAttiva, statoIscrizioneHome } from "@/lib/home/vista";
import { descriviPosti } from "@/lib/tappe/format";
import { tappaHref, TAPPE_PATH } from "@/lib/tappe/paths";

const linkSuPrimary =
  "inline-flex min-h-11 max-w-full items-center font-heading font-semibold underline decoration-2 underline-offset-4 hover:decoration-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground";

/**
 * w-home on the other days (BLVS-52): the next stage, mine if I am
 * registered to one, with my registration as text and the way to sign up
 * while registrations are open.
 */
export function HomeProssima({ tappa, iscrizione }: HomeProssimaData) {
  const stato = statoIscrizioneHome(iscrizione, tappa);
  const mia = iscrizioneAttiva(iscrizione);
  return (
    <section
      aria-labelledby="home-prossima-titolo"
      data-testid="home-prossima"
      data-iscrizione={stato.tipo}
      className="flex max-w-3xl flex-col bg-primary text-primary-foreground"
    >
      <Tape size={8} />
      <div className="flex flex-col gap-space-4 p-inset md:p-inset-lg">
        <h2
          id="home-prossima-titolo"
          className="text-sm font-semibold tracking-wide uppercase"
        >
          {mia ? "La tua prossima tappa" : "Prossima tappa"}
        </h2>
        <div className="flex flex-col gap-space-2">
          <p className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere] md:text-3xl">
            {tappa.name}
          </p>
          <p className="[overflow-wrap:anywhere]">{tappa.place}</p>
          <p className="font-mono text-lg tabular-nums">{tappa.date}</p>
          <p>
            <StatoTappaBadge stato={tappa.stato} />
          </p>
        </div>

        <div
          className="flex flex-col gap-space-2"
          data-testid="home-iscrizione"
        >
          <h3 className="text-sm font-semibold tracking-wide uppercase">
            La tua iscrizione
          </h3>
          <p
            className={
              stato.tipo === "iscritto"
                ? "self-start bg-tape px-space-3 py-space-1 font-heading text-lg font-semibold text-primary"
                : "font-heading text-lg font-semibold"
            }
          >
            {stato.testo}
          </p>
          {stato.tipo === "aperte" && tappa.scadenza ? (
            <p>
              Chiudono il{" "}
              <time
                dateTime={tappa.scadenzaIso ?? undefined}
                className="font-mono tabular-nums"
              >
                {tappa.scadenza}
              </time>
            </p>
          ) : null}
          {!mia && tappa.posti ? (
            <p>
              Posti nella tua categoria:{" "}
              <span className="font-mono tabular-nums">
                {descriviPosti(tappa.posti)}
              </span>
            </p>
          ) : null}
        </div>

        <p className="flex flex-wrap items-center gap-x-space-5 gap-y-space-3">
          {stato.tipo === "aperte" ? (
            <Link
              href={tappaHref(tappa.id)}
              className="inline-flex min-h-11 max-w-full items-center bg-tape px-space-5 font-heading font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
            >
              Iscriviti alla tappa
            </Link>
          ) : (
            <Link href={tappaHref(tappa.id)} className={linkSuPrimary}>
              Dettagli della tappa
            </Link>
          )}
          <Link href={TAPPE_PATH} className={linkSuPrimary}>
            Tutte le tappe
          </Link>
        </p>
      </div>
    </section>
  );
}

/** w-home with no stage ahead (BLVS-52). */
export function HomeVuota() {
  return (
    <section
      aria-labelledby="home-vuota-titolo"
      data-testid="home-vuota"
      className="flex max-w-3xl flex-col gap-space-3 border-2 border-primary p-inset md:p-inset-lg"
    >
      <h2 id="home-vuota-titolo" className="font-heading text-xl font-semibold">
        Nessuna tappa in programma
      </h2>
      <p>
        Al momento non ci sono tappe in arrivo. Quando l&apos;organizzazione
        pubblica la prossima, la trovi qui con le iscrizioni.
      </p>
      <p className="flex flex-wrap gap-x-space-5 gap-y-space-3">
        <Link
          href={TAPPE_PATH}
          className={buttonVariants({
            variant: "secondary",
            className: "max-w-full",
          })}
        >
          Tutte le tappe
        </Link>
        <Link
          href="/classifica"
          className={buttonVariants({
            variant: "secondary",
            className: "max-w-full",
          })}
        >
          Classifica generale
        </Link>
      </p>
    </section>
  );
}
