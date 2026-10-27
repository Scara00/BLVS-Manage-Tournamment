import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CATEGORIE } from "@/lib/db/types";
import { partiteDaInserireLabel } from "@/lib/admin/tappe";
import {
  contaDaInserire,
  coppie,
  daInserire,
  setPartita,
} from "@/lib/punteggi/format";
import { punteggioPath } from "@/lib/punteggi/paths";
import type { ElencoPunteggi, PartitaPunteggio } from "@/lib/punteggi/types";
import { CATEGORIA_NOME } from "@/lib/tappe/avvio/paths";

function perGirone(partite: readonly PartitaPunteggio[]) {
  const gironi = new Map<
    string,
    { nome: string; partite: PartitaPunteggio[] }
  >();
  for (const p of partite) {
    const g = gironi.get(p.gironeId) ?? { nome: p.gironeNome, partite: [] };
    g.partite.push(p);
    gironi.set(p.gironeId, g);
  }
  return [...gironi.entries()];
}

function RigaPartita({
  tappaId,
  partita,
  giocabile,
}: {
  tappaId: string;
  partita: PartitaPunteggio;
  giocabile: boolean;
}) {
  const nomi = coppie(partita);
  const set = setPartita(partita.sets);
  const manca = daInserire(partita);
  const descrizione = `${nomi.a} contro ${nomi.b}, turno ${partita.turno}`;
  return (
    <li
      data-partita={partita.id}
      data-da-inserire={manca || undefined}
      className="flex flex-wrap items-center justify-between gap-space-3 border-2 border-primary p-inset"
    >
      <div className="flex min-w-0 flex-col gap-space-1 [overflow-wrap:anywhere]">
        <span className="text-sm font-semibold">Turno {partita.turno}</span>
        <span className="font-heading text-lg font-semibold">
          {nomi.a} <span className="font-normal">contro</span> {nomi.b}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-space-3">
        {partita.stato === "in_corso" && partita.parziale ? (
          <span
            data-testid="parziale-elenco"
            className="inline-flex items-center gap-space-2"
          >
            <span className="bg-live-bg px-space-2 py-space-1 text-xs font-semibold tracking-wide text-live-fg uppercase">
              Parziale
            </span>
            <span className="font-mono text-xl font-bold tabular-nums">
              {partita.parziale.a}–{partita.parziale.b}
            </span>
          </span>
        ) : null}
        {partita.stato === "annullata" ? (
          <Badge>Annullata</Badge>
        ) : set && !manca ? (
          <span className="font-mono text-2xl font-bold tabular-nums">
            <span className="sr-only">Punteggio </span>
            {set.a}–{set.b}
          </span>
        ) : (
          <Badge variant="tape">Da inserire</Badge>
        )}
        {giocabile && partita.stato !== "annullata" ? (
          <Link
            href={punteggioPath(tappaId, partita.id)}
            aria-label={`${manca ? "Inserisci il punteggio" : "Correggi il punteggio"}: ${descrizione}`}
            className={buttonVariants({
              variant: manca ? "primary" : "secondary",
              size: "campo",
              className: "max-w-full",
            })}
          >
            {manca ? "Inserisci" : "Correggi"}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * w-admin-live: the group matches of a stage, board by board and group by
 * group, with the result or «Da inserire» and the link to score entry.
 */
export function ElencoPunteggiView({ elenco }: { elenco: ElencoPunteggi }) {
  const { tappa, partite } = elenco;
  const giocabile = tappa.stato === "in_corso";
  const mancanti = contaDaInserire(partite);
  return (
    <div className="flex flex-col gap-stack-lg" data-testid="elenco-punteggi">
      <section
        aria-labelledby="elenco-punteggi-tappa"
        className="flex flex-col gap-space-2"
      >
        <h2
          id="elenco-punteggi-tappa"
          className="font-heading text-2xl font-semibold text-balance [overflow-wrap:anywhere]"
        >
          {tappa.nome}
        </h2>
        <p
          data-testid="conta-da-inserire"
          data-count={mancanti}
          className="self-start border-s-8 border-primary bg-tape p-inset font-heading text-lg font-semibold text-primary"
        >
          {partite.length === 0
            ? "Nessuna partita dei gironi: avvia prima una fase."
            : mancanti === 0
              ? "Tutte le partite sono inserite"
              : partiteDaInserireLabel(mancanti)}
        </p>
        {!giocabile && partite.length > 0 ? (
          <p>La tappa non è in corso: i punteggi non si modificano da qui.</p>
        ) : null}
      </section>
      {CATEGORIE.map((categoria) => {
        const delTabellone = partite.filter((p) => p.categoria === categoria);
        if (delTabellone.length === 0) return null;
        return (
          <section
            key={categoria}
            aria-labelledby={`tabellone-${categoria}`}
            className="flex flex-col gap-stack-sm"
          >
            <h2
              id={`tabellone-${categoria}`}
              className="font-heading text-xl font-semibold"
            >
              Tabellone {CATEGORIA_NOME[categoria]}
            </h2>
            {perGirone(delTabellone).map(([gironeId, girone]) => (
              <section
                key={gironeId}
                aria-labelledby={`girone-${gironeId}`}
                className="flex flex-col gap-space-2"
              >
                <h3
                  id={`girone-${gironeId}`}
                  className="font-heading text-lg font-semibold"
                >
                  {girone.nome}
                </h3>
                <ul className="flex flex-col gap-space-2">
                  {girone.partite.map((p) => (
                    <RigaPartita
                      key={p.id}
                      tappaId={tappa.id}
                      partita={p}
                      giocabile={giocabile}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </section>
        );
      })}
    </div>
  );
}
