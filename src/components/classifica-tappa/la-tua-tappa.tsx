import { BadgeTu, PuntiProvvisori } from "@/components/classifica-generale";
import type { StageStandings } from "@/lib/live/types";
import {
  FASE_FINALE_LABEL,
  puntiRigaLabel,
  rigaMia,
} from "@/lib/tappe/classifica/live";

/**
 * «La tua tappa» (BLVS-49): the signed-in player's place and points in
 * this stage, above the standing. Points are always the current ones,
 * marked «provvisori» as text until the board is closed (client
 * decision). A player not in the finals is told they score 0 points.
 */
export function LaTuaTappa({
  standings,
  me,
}: {
  standings: StageStandings | undefined;
  me: string | null;
}) {
  const riga = rigaMia(standings, me);
  const provvisori = standings?.provisional ?? true;
  const finaliIniziate =
    standings !== undefined && standings.state !== "in_attesa";
  const pari =
    riga !== undefined &&
    (standings?.rows ?? []).some(
      (r) => r.playerId !== riga.playerId && r.position === riga.position,
    );

  return (
    <section
      aria-labelledby="la-tua-tappa"
      data-testid="la-tua-tappa"
      className="flex flex-col gap-space-3 border-2 border-primary p-inset"
    >
      <h2
        id="la-tua-tappa"
        className="flex flex-wrap items-center gap-space-2 font-heading text-lg font-semibold"
      >
        La tua tappa
        {riga ? <BadgeTu /> : null}
      </h2>
      {riga ? (
        <>
          <dl className="flex flex-wrap gap-x-space-6 gap-y-space-3">
            <div className="flex flex-col">
              <dt className="text-sm text-foreground">Posizione</dt>
              <dd className="font-mono text-3xl font-semibold tabular-nums">
                {riga.position}ª
                {pari ? (
                  <span className="ms-space-2 font-sans text-base font-normal">
                    pari merito
                  </span>
                ) : null}
              </dd>
            </div>
            {riga.phase ? (
              <div className="flex flex-col">
                <dt className="text-sm text-foreground">Finale</dt>
                <dd className="font-heading text-xl font-semibold">
                  {FASE_FINALE_LABEL[riga.phase]}
                </dd>
              </div>
            ) : null}
            <div className="flex flex-col">
              <dt className="text-sm text-foreground">Punti</dt>
              <dd className="flex flex-wrap items-center gap-space-2">
                <span className="font-mono text-3xl font-semibold tabular-nums">
                  {riga.points ?? "–"}
                </span>
                {provvisori ? <PuntiProvvisori /> : null}
              </dd>
            </div>
          </dl>
          <p className="text-sm" data-testid="la-tua-tappa-punti">
            {riga.points === null
              ? "I punti arrivano quando si sa in quale finale giochi."
              : provvisori
                ? `${puntiRigaLabel(riga.points, true)}: diventano definitivi quando l'organizzazione chiude il tabellone.`
                : `${puntiRigaLabel(riga.points, false)}: punti definitivi.`}
            {riga.points !== null && !riga.definitive
              ? " La tua posizione non è ancora definitiva."
              : null}
          </p>
        </>
      ) : finaliIniziate ? (
        <p>Non sei in finale: 0 punti in questa tappa.</p>
      ) : (
        <p>
          Le finali non sono ancora iniziate: i tuoi punti arrivano con le
          finali gold e silver.
        </p>
      )}
    </section>
  );
}
