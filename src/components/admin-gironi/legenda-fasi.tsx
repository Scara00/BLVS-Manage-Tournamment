import { cn } from "cn";
import type { FaseTabellone } from "@/lib/db/types";

/** Same marks and colours as `PhaseBadge` (BLVS-05). */
const FASI: Record<
  FaseTabellone,
  { icona: string; nome: string; tono: string }
> = {
  gold: { icona: "★", nome: "Gold", tono: "border-tape bg-tape text-primary" },
  silver: {
    icona: "◆",
    nome: "Silver",
    tono: "border-input bg-neutral-100 text-neutral-800",
  },
};

/**
 * The compact Gold/Silver mark of a group: the icon only, with the name
 * for screen readers. The legend (`LegendaFasi`) explains it once.
 */
export function FaseMarker({
  fase,
  className,
}: {
  fase: FaseTabellone;
  className?: string;
}) {
  const { icona, nome, tono } = FASI[fase];
  return (
    <span
      data-slot="fase-marker"
      data-fase={fase}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-none border-2 font-heading text-sm font-semibold",
        tono,
        className,
      )}
    >
      <span aria-hidden>{icona}</span>
      <span className="sr-only">{nome}</span>
    </span>
  );
}

/** Shown once above the groups (not repeated on every group or row). */
export function LegendaFasi() {
  return (
    <div
      data-slot="legenda-fasi"
      className="flex flex-wrap items-center gap-x-space-4 gap-y-space-2 text-sm"
    >
      <span className="font-semibold">Legenda</span>
      {(Object.keys(FASI) as FaseTabellone[]).map((fase) => (
        <span key={fase} className="inline-flex items-center gap-space-2">
          <span aria-hidden className="flex">
            <FaseMarker fase={fase} />
          </span>
          <span>Girone {FASI[fase].nome}</span>
        </span>
      ))}
    </div>
  );
}
