import { Badge } from "@/components/ui/badge";
import type { StatoTappa } from "@/lib/db/types";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";

const VARIANT = {
  bozza: "reg-draft",
  iscrizioni_aperte: "reg-open",
  iscrizioni_chiuse: "reg-closed",
  in_corso: "info",
  conclusa: "neutral",
  annullata: "reg-cancelled",
  archiviata: "tape",
} as const satisfies Record<StatoTappa, string>;

/** State of a stage: `color.reg.*` surface, always with its text. */
export function StatoTappaBadge({
  stato,
  className,
}: {
  stato: StatoTappa;
  className?: string;
}) {
  return (
    <Badge variant={VARIANT[stato]} data-stato={stato} className={className}>
      {STATO_TAPPA_LABEL[stato]}
    </Badge>
  );
}
