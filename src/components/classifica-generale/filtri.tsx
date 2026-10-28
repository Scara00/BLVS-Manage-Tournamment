import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { stagioneLabel } from "@/lib/classifica-generale/stagione";
import { CATEGORIE, type Categoria } from "@/lib/db/types";
import { CLASSIFICA_PATH } from "@/lib/navigation/auth-paths";
import { cn } from "@/lib/utils";

const CATEGORIA_LABEL: Record<Categoria, string> = {
  M: "Maschile",
  F: "Femminile",
};

export function classificaHref(categoria: Categoria, stagione: number) {
  const params = new URLSearchParams({
    categoria,
    stagione: String(stagione),
  });
  return `${CLASSIFICA_PATH}?${params}`;
}

/** Category switch: two links, the current one marked (aria-current). */
export function SceltaCategoria({
  categoria,
  stagione,
}: {
  categoria: Categoria;
  stagione: number;
}) {
  return (
    <nav aria-label="Categoria">
      <ul className="flex flex-wrap gap-space-2">
        {CATEGORIE.map((c) => {
          const attiva = c === categoria;
          return (
            <li key={c}>
              <Link
                href={classificaHref(c, stagione)}
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

/** Season filter (Q-06): a GET form, works without JavaScript. */
export function SceltaStagione({
  categoria,
  stagione,
  stagioni,
}: {
  categoria: Categoria;
  stagione: number;
  stagioni: readonly number[];
}) {
  return (
    <form
      method="get"
      action={CLASSIFICA_PATH}
      className="flex flex-wrap items-end gap-space-3"
    >
      <input type="hidden" name="categoria" value={categoria} />
      <Field label="Stagione" className="w-auto min-w-48">
        <Select name="stagione" defaultValue={String(stagione)}>
          {stagioni.map((s) => (
            <option key={s} value={s}>
              {stagioneLabel(s)}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary">
        Mostra
      </Button>
    </form>
  );
}
