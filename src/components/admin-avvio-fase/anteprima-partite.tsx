import { Fragment } from "react";
import { Tape } from "@/components/scoreboard";
import type {
  GiocatoreAvvio,
  GironeAvvio,
  PartitaAnteprima,
} from "@/lib/tappe/avvio/regole";

function Lettera({ lettera }: { lettera: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-6 shrink-0 items-center justify-center bg-tape font-mono text-sm font-semibold text-primary"
    >
      {lettera}
    </span>
  );
}

function Giocatore({ giocatore }: { giocatore: GiocatoreAvvio }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-space-1">
      <Lettera lettera={giocatore.lettera} />
      <span className="sr-only">{giocatore.lettera}, </span>
      <span className="[overflow-wrap:anywhere]">{giocatore.cognome}</span>
    </span>
  );
}

/**
 * One pair on its own row: the letters side by side, then the surnames
 * joined by «/» as beach volley writes a pair. Screen readers hear
 * «A, Rossi e B, Bianchi».
 */
function Coppia({ giocatori }: { giocatori: readonly GiocatoreAvvio[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-space-3 gap-y-space-1 border-s-4 border-primary py-space-2 ps-space-3 pe-space-2">
      <span aria-hidden className="flex shrink-0 gap-space-1">
        {giocatori.map((g) => (
          <Lettera key={g.iscrizioneId} lettera={g.lettera} />
        ))}
      </span>
      <span className="min-w-0 flex-[1_1_8rem] font-semibold [overflow-wrap:anywhere]">
        {giocatori.map((g, i) => (
          <Fragment key={g.iscrizioneId}>
            {i > 0 ? (
              <>
                <span aria-hidden> / </span>
                <span className="sr-only"> e </span>
              </>
            ) : null}
            <span className="sr-only">{g.lettera}, </span>
            {g.cognome}
          </Fragment>
        ))}
      </span>
    </div>
  );
}

/** The two pairs stacked, split by a «VS» band (read as «contro»). */
function Sfida({ partita }: { partita: PartitaAnteprima }) {
  return (
    <div className="flex flex-col border border-neutral-200">
      <Coppia giocatori={partita.squadraA} />
      <div className="flex items-center gap-space-2 px-space-3">
        <span aria-hidden className="h-px flex-1 bg-neutral-200" />
        <span
          aria-hidden
          className="font-mono text-xs font-bold tracking-widest"
        >
          VS
        </span>
        <span className="sr-only"> contro </span>
        <span aria-hidden className="h-px flex-1 bg-neutral-200" />
      </div>
      <Coppia giocatori={partita.squadraB} />
    </div>
  );
}

/** «Turno 2»; with two matches per turn (mixed) «Partita 3 · turno 2». */
function etichettaPartita(
  partita: PartitaAnteprima,
  partite: readonly PartitaAnteprima[],
): string {
  const stessoTurno = partite.filter((p) => p.turno === partita.turno);
  return stessoTurno.length > 1
    ? `Partita ${partita.numero} · turno ${partita.turno}`
    : `Turno ${partita.turno}`;
}

/**
 * Per group: its players by letter, then the matches of the rotation with
 * letters and surnames (3 in a group of 4, 8 in a mixed group of 4 + 4).
 */
export function AnteprimaPartite({
  anteprima,
  titolo = "Anteprima delle partite",
  misto = false,
}: {
  anteprima: readonly { girone: GironeAvvio; partite: PartitaAnteprima[] }[];
  titolo?: string;
  /** Mixed board: a full group is 4 men + 4 women. */
  misto?: boolean;
}) {
  return (
    <section
      aria-labelledby="anteprima-titolo"
      className="flex flex-col gap-stack-sm"
    >
      <h2 id="anteprima-titolo" className="font-heading text-xl font-semibold">
        {titolo}
      </h2>
      {anteprima.length === 0 ? (
        <p>Nessun girone: non ci sono partite da mostrare.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-stack">
          {anteprima.map(({ girone, partite }) => (
            <section
              key={girone.id}
              id={`girone-${girone.id}`}
              aria-labelledby={`anteprima-${girone.id}`}
              className="flex flex-col gap-space-3 border-2 border-neutral-200 p-inset"
            >
              <div className="flex flex-col gap-space-1">
                <h3
                  id={`anteprima-${girone.id}`}
                  className="font-heading text-lg font-semibold"
                >
                  {girone.nome}
                </h3>
                <Tape size={4} className="max-w-16" />
              </div>
              <ul
                aria-label={`Giocatori del ${girone.nome}`}
                className="flex flex-col gap-space-1"
              >
                {girone.giocatori.map((g) => (
                  <li key={g.iscrizioneId}>
                    <Giocatore giocatore={g} />
                  </li>
                ))}
              </ul>
              {partite.length === 0 ? (
                <p className="text-sm">
                  {misto
                    ? "Nessuna partita: il girone non ha 4 uomini e 4 donne."
                    : "Nessuna partita: il girone non ha 4 giocatori."}
                </p>
              ) : (
                <ol
                  aria-label={`Partite del ${girone.nome}`}
                  className="flex flex-col gap-space-3 border-t border-neutral-200 pt-space-3"
                >
                  {partite.map((p) => (
                    <li key={p.numero} className="flex flex-col gap-space-1">
                      <span className="font-mono text-sm font-semibold">
                        {etichettaPartita(p, partite)}
                        <span className="sr-only">: </span>
                      </span>
                      <Sfida partita={p} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
