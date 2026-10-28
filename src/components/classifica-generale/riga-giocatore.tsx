import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { nomeGiocatore } from "@/lib/classifica-generale/giocatore";
import type { OverallPlayerRow } from "@/lib/live/types";

/** «TU» on color.primary; the screen reader hears «sei tu». */
export function BadgeTu() {
  return (
    <span className="inline-flex items-center bg-primary px-space-2 py-space-1 font-heading text-xs leading-4 font-semibold tracking-wide text-primary-foreground">
      <span aria-hidden="true">TU</span>
      <span className="sr-only">sei tu</span>
    </span>
  );
}

/** «provvisori» as text on color.tape, never colour alone (R-49). */
export function PuntiProvvisori() {
  return (
    <Badge variant="tape" data-slot="punti-provvisori">
      provvisori
    </Badge>
  );
}

/** The player's name; with `href`, a link to their card (w-giocatore). */
export function NomeGiocatore({
  row,
  mio,
  href,
}: {
  row: OverallPlayerRow;
  mio: boolean;
  href?: string;
}) {
  const nome = nomeGiocatore(row);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
      {href ? (
        <Link
          href={href}
          className="underline decoration-2 underline-offset-4 focus-ring"
          data-testid="link-giocatore"
        >
          {nome}
        </Link>
      ) : (
        <span>{nome}</span>
      )}
      {mio ? <BadgeTu /> : null}
      {row.tied ? (
        <span className="font-sans text-sm font-normal">(pari merito)</span>
      ) : null}
    </span>
  );
}

export function PuntiGiocatore({ row }: { row: OverallPlayerRow }) {
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-space-2">
      <span>{row.points}</span>
      {row.provisional ? <PuntiProvvisori /> : null}
    </span>
  );
}
