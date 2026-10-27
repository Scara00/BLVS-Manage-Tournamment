import type { StatoTappa } from "@/lib/db/types";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import { cn } from "@/lib/utils";

const statoStyle: Record<StatoTappa, string> = {
  bozza: "bg-reg-draft-bg text-reg-draft-fg",
  iscrizioni_aperte: "bg-reg-open-bg text-reg-open-fg",
  iscrizioni_chiuse: "bg-reg-closed-bg text-reg-closed-fg",
  in_corso: "bg-live-bg text-live-fg",
  conclusa: "bg-reg-closed-bg text-reg-closed-fg",
  annullata: "bg-reg-cancelled-bg text-reg-cancelled-fg",
};

/** The stage state as text on its `color.reg.*` surface: never colour alone. */
export function StatoTappaBadge({
  stato,
  className,
}: {
  stato: StatoTappa;
  className?: string;
}) {
  return (
    <span
      data-stato={stato}
      className={cn(
        "inline-block max-w-full px-space-2 py-space-1 text-xs font-semibold tracking-wide [overflow-wrap:anywhere] uppercase",
        statoStyle[stato],
        className,
      )}
    >
      {STATO_TAPPA_LABEL[stato]}
    </span>
  );
}
