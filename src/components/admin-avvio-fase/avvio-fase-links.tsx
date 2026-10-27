import { PlayIcon, RadioIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { StatoTappa } from "@/lib/db/types";
import { avvioFasePath } from "@/lib/tappe/avvio/paths";
import { adminLivePath } from "@/lib/tappe/live-admin/paths";
import type { TabelloneView } from "@/lib/tappe/gestione-format";

/**
 * From the stage page to w-admin-avvio-fase, one link per board, once
 * registrations are closed; with the stage in progress, also to
 * w-admin-live (BLVS-31).
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
      {stato === "in_corso"
        ? tabelloni.map((t) => (
            <Link
              key={`live-${t.categoria}`}
              href={adminLivePath(tappaId, t.categoria)}
              className={buttonVariants({
                variant: "primary",
                className: "max-w-full",
              })}
            >
              <RadioIcon aria-hidden className="size-4" />
              Gestione live · {t.categoriaLabel}
            </Link>
          ))
        : null}
    </nav>
  );
}
