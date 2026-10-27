import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { Ref } from "react";
import type { Categoria } from "@/lib/db/types";
import { linkProblema } from "@/lib/tappe/avvio/paths";
import {
  messaggioProblema,
  type ProblemaAvvio,
} from "@/lib/tappe/avvio/regole";

/**
 * What blocks the start, one item per error with a link to the group (or
 * to the players out of every group) in the groups editor. The heading
 * takes focus after a refused attempt.
 */
export function ErroriAvvio({
  tappaId,
  categoria,
  problemi,
  headingRef,
}: {
  tappaId: string;
  categoria: Categoria;
  problemi: readonly ProblemaAvvio[];
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  if (problemi.length === 0) return null;
  return (
    <section
      aria-labelledby="errori-avvio-titolo"
      className="flex flex-col gap-space-3 border-2 border-error-fg p-inset"
      data-testid="errori-avvio"
    >
      <h2
        id="errori-avvio-titolo"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-xl font-semibold focus-ring"
      >
        {problemi.length === 1
          ? "1 problema da correggere"
          : `${problemi.length} problemi da correggere`}
      </h2>
      <ul className="flex flex-col gap-space-2">
        {problemi.map((p, i) => (
          <li
            key={`${p.regola}-${p.gironeId ?? ""}-${p.dettaglio ?? ""}-${i}`}
            className="flex flex-col items-start gap-space-1 [overflow-wrap:anywhere]"
          >
            <span>
              <span className="sr-only">Errore: </span>
              {messaggioProblema(p)}
            </span>
            <Link
              href={linkProblema(tappaId, categoria, p)}
              className="inline-flex items-center gap-space-1 font-semibold underline decoration-2 underline-offset-4 focus-ring"
            >
              {p.gironeNome ? `Vai al ${p.gironeNome}` : "Vai ai gironi"}
              <ArrowRightIcon aria-hidden className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
