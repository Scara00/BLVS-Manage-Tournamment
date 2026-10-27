import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import type { ControlliGironi as Esito } from "@/lib/gironi/editor/controlli";

/**
 * The checks of the groups (4 per group, no duplicates, everyone
 * assigned), recomputed on every change. Visible text with an icon, never
 * colour alone. They warn, they do not block: an incomplete group can stay.
 * The announcement of each change lives in the editor's status region.
 */
export function ControlliGironi({ esito }: { esito: Esito }) {
  return (
    <section
      aria-labelledby="controlli-gironi-titolo"
      data-testid="controlli-gironi"
      className="flex flex-col gap-space-3 border-2 border-neutral-200 p-inset"
    >
      <h2
        id="controlli-gironi-titolo"
        className="font-heading text-lg font-semibold"
      >
        Controlli
      </h2>
      <ul className="flex flex-col gap-space-3">
        {esito.controlli.map((c) => (
          <li
            key={c.codice}
            data-controllo={c.codice}
            data-ok={c.ok || undefined}
            className="flex items-start gap-space-2"
          >
            {c.ok ? (
              <CheckCircle2Icon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-success-fg"
              />
            ) : (
              <TriangleAlertIcon
                aria-hidden
                className="mt-1 size-5 shrink-0 text-warning-fg"
              />
            )}
            <div className="flex min-w-0 flex-col gap-space-1">
              <p>
                <span className="font-semibold">{c.titolo}</span>
                {": "}
                {c.ok ? "superato" : "da rivedere"}
              </p>
              {c.problemi.length > 0 ? (
                <ul className="list-disc ps-space-5 text-sm [overflow-wrap:anywhere]">
                  {c.problemi.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {esito.valido ? null : (
        <p className="text-sm text-muted-foreground">
          Puoi tenere i gironi anche così: i controlli sono solo un avviso.
        </p>
      )}
    </section>
  );
}
