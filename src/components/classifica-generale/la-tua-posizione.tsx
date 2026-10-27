import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { puntiProvvisoriLabel } from "@/lib/classifica-generale/annuncio";
import type { OverallPlayerRow } from "@/lib/live/types";
import { CLASSIFICA_PATH, loginHref } from "@/lib/navigation/auth-paths";
import { BadgeTu, PuntiProvvisori } from "./riga-giocatore";

/**
 * «La tua posizione» (R-46): the signed-in player's place, points and
 * stages, above the table. Signed-out visitors get the way to sign in.
 */
export function LaTuaPosizione({
  me,
  row,
}: {
  me: string | null;
  row: OverallPlayerRow | undefined;
}) {
  return (
    <section
      aria-labelledby="la-tua-posizione"
      data-testid="la-tua-posizione"
      className="flex flex-col gap-space-3 border-2 border-primary p-inset"
    >
      <h2
        id="la-tua-posizione"
        className="flex flex-wrap items-center gap-space-2 font-heading text-lg font-semibold"
      >
        La tua posizione
        {row ? <BadgeTu /> : null}
      </h2>
      {row ? (
        <dl className="flex flex-wrap gap-x-space-6 gap-y-space-3">
          <div className="flex flex-col">
            <dt className="text-sm text-foreground">Posizione</dt>
            <dd className="font-mono text-3xl font-semibold tabular-nums">
              {row.position}ª
              {row.tied ? (
                <span className="ms-space-2 font-sans text-base font-normal">
                  pari merito
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-foreground">Punti</dt>
            <dd className="flex flex-wrap items-center gap-space-2">
              <span className="font-mono text-3xl font-semibold tabular-nums">
                {row.points}
              </span>
              {row.provisional ? <PuntiProvvisori /> : null}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-sm text-foreground">Tappe giocate</dt>
            <dd className="font-mono text-3xl font-semibold tabular-nums">
              {row.stages}
            </dd>
          </div>
        </dl>
      ) : me ? (
        <p>
          Non sei ancora in questa classifica: entri dopo la prima partita
          giocata in una tappa.
        </p>
      ) : (
        <div className="flex flex-col items-start gap-space-3">
          <p>Accedi per vedere la tua posizione e i tuoi punti.</p>
          <Link
            href={loginHref(CLASSIFICA_PATH)}
            className={buttonVariants({ variant: "secondary" })}
          >
            Accedi
          </Link>
        </div>
      )}
      {row?.provisional ? (
        <p className="text-sm">
          {puntiProvvisoriLabel(row.points)}: diventano definitivi quando
          l&apos;organizzazione chiude il tabellone della tappa.
        </p>
      ) : null}
    </section>
  );
}
