import { FlaskConicalIcon } from "lucide-react";
import { AVVISO_PROVA } from "@/lib/tappe/prova";

/**
 * On the player pages of a «tappa di prova»: only an admin can see them,
 * and the notice says so, so a test draft is never mistaken for a
 * published stage.
 */
export function AvvisoTappaProva() {
  return (
    <div
      role="note"
      data-testid="avviso-tappa-prova"
      className="flex items-start gap-space-2 border-2 border-dashed border-primary p-inset font-medium"
    >
      <FlaskConicalIcon aria-hidden className="mt-1 size-4 shrink-0" />
      <p>{AVVISO_PROVA}</p>
    </div>
  );
}
