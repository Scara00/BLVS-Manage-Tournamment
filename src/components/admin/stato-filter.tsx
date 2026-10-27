import Link from "next/link";
import {
  FILTRI_STATO,
  FILTRO_STATO_PARAM,
  type FiltroStato,
} from "@/lib/admin/tappe";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import { cn } from "@/lib/utils";

export function filtroLabel(filtro: FiltroStato): string {
  return filtro === "tutte" ? "Tutte" : STATO_TAPPA_LABEL[filtro];
}

export function filtroHref(basePath: string, filtro: FiltroStato): string {
  return filtro === "tutte"
    ? basePath
    : `${basePath}?${FILTRO_STATO_PARAM}=${filtro}`;
}

/**
 * Status filter as plain links (`?stato=`): it works without JavaScript,
 * survives a reload and can be shared. The current one has
 * `aria-current="true"` plus the tape surface, never colour alone.
 */
export function StatoFilter({
  basePath,
  current,
  counts,
}: {
  basePath: string;
  current: FiltroStato;
  counts: Record<FiltroStato, number>;
}) {
  return (
    <nav aria-label="Filtra le tappe per stato">
      <ul className="flex flex-wrap gap-space-2">
        {FILTRI_STATO.map((filtro) => {
          const active = filtro === current;
          return (
            <li key={filtro}>
              <Link
                href={filtroHref(basePath, filtro)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                data-filtro={filtro}
                className={cn(
                  "inline-flex min-h-10 items-center gap-space-2 border border-input px-space-3 py-space-1 font-heading text-sm font-medium whitespace-normal focus-ring",
                  "aria-[current=true]:border-primary aria-[current=true]:bg-tape aria-[current=true]:font-bold aria-[current=true]:text-primary",
                  "not-aria-[current=true]:hover:bg-neutral-100",
                )}
              >
                {filtroLabel(filtro)}
                <span className="font-mono tabular-nums">
                  <span aria-hidden="true">{counts[filtro]}</span>
                  <span className="sr-only">
                    {counts[filtro] === 1
                      ? ", 1 tappa"
                      : `, ${counts[filtro]} tappe`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
