import { Badge } from "@/components/ui/badge";
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

export function NomeGiocatore({
  row,
  mio,
}: {
  row: OverallPlayerRow;
  mio: boolean;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-space-2 gap-y-space-1">
      <span>{row.name}</span>
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
