import { PlayIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { StatoTappa } from "@/lib/db/types";
import { avvioFasePath } from "@/lib/tappe/avvio/paths";
import type { TabelloneView } from "@/lib/tappe/gestione-format";

/**
 * From the stage page to w-admin-avvio-fase, one link per board, once
 * registrations are closed.
 */
export function AvvioFaseLinks({
  tappaId,
  stato,
  tabelloni,
}: {
  tappaId: string;
  stato: StatoTappa;
  tabelloni: readonly TabelloneView[];
}) {
  if (stato !== "iscrizioni_chiuse" && stato !== "in_corso") return null;
  return (
    <nav aria-label="Avvio fase" className="flex flex-wrap gap-space-2">
      {tabelloni.map((t) => (
        <Link
          key={t.categoria}
          href={avvioFasePath(tappaId, t.categoria)}
          className={buttonVariants({
            variant: "secondary",
            className: "max-w-full",
          })}
        >
          <PlayIcon aria-hidden className="size-4" />
          Avvio fase · {t.categoriaLabel}
        </Link>
      ))}
    </nav>
  );
}
