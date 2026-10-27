import {
  Ban,
  CircleDot,
  DoorOpen,
  Flag,
  Lock,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StatoTappa } from "@/lib/db/types";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";

type Variant =
  "reg-draft" | "reg-open" | "reg-closed" | "reg-cancelled" | "live";

const stati: Record<StatoTappa, { icon: LucideIcon; variant: Variant }> = {
  bozza: { icon: PencilLine, variant: "reg-draft" },
  iscrizioni_aperte: { icon: DoorOpen, variant: "reg-open" },
  iscrizioni_chiuse: { icon: Lock, variant: "reg-closed" },
  in_corso: { icon: CircleDot, variant: "live" },
  conclusa: { icon: Flag, variant: "reg-closed" },
  annullata: { icon: Ban, variant: "reg-cancelled" },
};

/** Stage status as text plus icon: colour never carries it alone. */
export function StatoTappaBadge({ stato }: { stato: StatoTappa }) {
  const { icon: Icon, variant } = stati[stato];
  return (
    <Badge variant={variant} icon={<Icon />} data-stato={stato}>
      {STATO_TAPPA_LABEL[stato]}
    </Badge>
  );
}
