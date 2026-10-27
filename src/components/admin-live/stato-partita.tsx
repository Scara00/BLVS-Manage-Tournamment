import { CheckIcon, CircleDotIcon, ClockIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { StatoPartita } from "@/lib/db/types";
import { STATO_PARTITA_LABEL } from "@/lib/tappe/live-admin/format";

const VARIANTE = {
  programmata: "neutral",
  in_corso: "live",
  conclusa: "success",
  annullata: "neutral",
} as const;

const ICONA = {
  programmata: <ClockIcon />,
  in_corso: <CircleDotIcon />,
  conclusa: <CheckIcon />,
  annullata: <XIcon />,
} as const;

/** The state of a match as text with an icon: «Da giocare», «In corso»… */
export function StatoPartitaBadge({ stato }: { stato: StatoPartita }) {
  return (
    <Badge variant={VARIANTE[stato]} icon={ICONA[stato]} data-stato={stato}>
      {STATO_PARTITA_LABEL[stato]}
    </Badge>
  );
}
