import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { ControlloView } from "@/lib/tappe/avvio/regole";

/** The three blocking checks on one row (they wrap at 200% text). */
export function ControlliAvvio({
  controlli,
}: {
  controlli: readonly ControlloView[];
}) {
  return (
    <ul
      aria-label="Controlli"
      className="flex flex-wrap gap-space-2"
      data-testid="controlli-avvio"
    >
      {controlli.map((c) => (
        <li
          key={c.chiave}
          data-ok={c.ok}
          className={
            c.ok
              ? "flex min-w-0 flex-1 basis-48 items-start gap-space-2 border-2 border-success-fg bg-success-bg p-inset-sm text-success-fg"
              : "flex min-w-0 flex-1 basis-48 items-start gap-space-2 border-2 border-error-fg bg-error-bg p-inset-sm text-error-fg"
          }
        >
          {c.ok ? (
            <CircleCheckIcon aria-hidden className="mt-1 size-4 shrink-0" />
          ) : (
            <CircleXIcon aria-hidden className="mt-1 size-4 shrink-0" />
          )}
          <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
            <span className="font-heading font-semibold">{c.label}</span>
            <span className="text-sm">
              {c.ok
                ? "Superato"
                : c.problemi === 1
                  ? "1 da correggere"
                  : `${c.problemi} da correggere`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
