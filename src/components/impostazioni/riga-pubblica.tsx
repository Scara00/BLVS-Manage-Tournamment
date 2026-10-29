import {
  BadgeTu,
  PuntiProvvisori,
} from "@/components/classifica-generale/riga-giocatore";
import { CATEGORIA_LABEL } from "@/components/profilo/categoria";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/responsive-table/responsive-table";
import type { Categoria } from "@/lib/db/types";
import type { OverallPlayerRow } from "@/lib/live/types";
import { cn } from "@/lib/utils";

/** «Classifica generale maschile · Stagione 2026», as on /classifica. */
export function titoloClassifica(categoria: Categoria, stagione: number) {
  return `Classifica generale ${CATEGORIA_LABEL[categoria]} · Stagione ${stagione}`;
}

/**
 * One row of the overall standing as /classifica shows it: place, name,
 * points (font.mono); a card below md.
 */
export function RigaPubblica({
  caption,
  riga,
  mio = false,
  className,
}: {
  caption: string;
  riga: OverallPlayerRow;
  mio?: boolean;
  className?: string;
}) {
  const columns: ResponsiveTableColumn<OverallPlayerRow>[] = [
    {
      key: "position",
      header: "Posizione",
      numeric: true,
      width: "20%",
      render: (r) => (
        <>
          {r.position}
          {r.tied ? <span className="sr-only"> (pari merito)</span> : null}
        </>
      ),
    },
    {
      key: "name",
      header: "Giocatore",
      rowHeader: true,
      render: (r) => (
        <span
          data-slot="nome"
          className="inline-flex flex-wrap items-center gap-x-space-2 gap-y-space-1"
        >
          <span>{r.name}</span>
          {mio ? <BadgeTu /> : null}
        </span>
      ),
    },
    {
      key: "points",
      header: "Punti",
      numeric: true,
      width: "30%",
      render: (r) => (
        <span className="inline-flex flex-wrap items-center justify-end gap-space-2">
          <span>{r.points}</span>
          {r.provisional ? <PuntiProvvisori /> : null}
        </span>
      ),
    },
  ];
  return (
    // Standings text is AAA (7:1): the card labels too, as on w-live.
    <div
      data-slot="riga-pubblica"
      className={cn("[&_dt]:text-foreground", className)}
    >
      <ResponsiveTable
        caption={caption}
        columns={columns}
        rows={[riga]}
        getRowKey={(r) => r.playerId}
        cardBadgeKey="position"
        rowAttributes={(r) => ({
          "data-posizione": String(r.position),
          "data-punti": String(r.points),
        })}
      />
    </div>
  );
}
