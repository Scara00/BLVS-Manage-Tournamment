import Link from "next/link";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import { classificaTappaHref } from "@/lib/tappe/paths";
import { cn } from "@/lib/utils";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

/** Category switch: two links, the current one marked (aria-current). */
export function SceltaCategoriaTappa({
  tappaId,
  categoria,
}: {
  tappaId: string;
  categoria: Categoria;
}) {
  return (
    <nav aria-label="Categoria">
      <ul className="flex flex-wrap gap-space-2">
        {CATEGORIE.map((c) => {
          const attiva = c === categoria;
          return (
            <li key={c}>
              <Link
                href={classificaTappaHref(tappaId, c)}
                aria-current={attiva ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-12 items-center border-2 border-primary px-space-4 font-heading font-semibold focus-ring",
                  attiva
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground underline decoration-2 underline-offset-4",
                )}
              >
                {CATEGORIA_LABEL[c]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
