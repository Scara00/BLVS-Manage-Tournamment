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

function Squadra({ giocatori }: { giocatori: readonly GiocatoreAvvio[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-space-1">
      {giocatori.map((g, i) => (
        <span
          key={g.iscrizioneId}
          className="inline-flex items-center gap-space-1"
        >
          {i > 0 ? <span>e</span> : null}
          <Giocatore giocatore={g} />
        </span>
      ))}
    </span>
  );
}

/**
 * Per group: its players by letter, then the three matches of the
 * rotation with letters and surnames.
 */
export function AnteprimaPartite({
  anteprima,
  titolo = "Anteprima delle partite",
}: {
  anteprima: readonly { girone: GironeAvvio; partite: PartitaAnteprima[] }[];
  titolo?: string;
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
                  Nessuna partita: il girone non ha 4 giocatori.
                </p>
              ) : (
                <ol
                  aria-label={`Partite del ${girone.nome}`}
                  className="flex flex-col gap-space-2"
                >
                  {partite.map((p) => (
                    <li
                      key={p.turno}
                      className="flex flex-col gap-space-1 border-t border-neutral-200 pt-space-2"
                    >
                      <span className="font-mono text-sm font-semibold">
                        Turno {p.turno}
                      </span>
                      <span className="flex flex-wrap items-center gap-space-2">
                        <Squadra giocatori={p.squadraA} />
                        <span className="font-semibold">contro</span>
                        <Squadra giocatori={p.squadraB} />
                      </span>
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
