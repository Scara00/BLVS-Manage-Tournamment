import {
  AlertTriangleIcon,
  CheckIcon,
  ClockIcon,
  HardDriveIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { etichettaStato } from "@/lib/punteggi/coda/coda";
import type { StatoVoce } from "@/lib/punteggi/coda/types";

const ASPETTO = {
  in_attesa: { variant: "tape", Icon: ClockIcon },
  invio: { variant: "tape", Icon: ClockIcon },
  salvato: { variant: "success", Icon: CheckIcon },
  sessione_chiusa: { variant: "warning", Icon: HardDriveIcon },
  conflitto: { variant: "warning", Icon: AlertTriangleIcon },
  rifiutato: { variant: "error", Icon: XIcon },
} as const;

/**
 * Where a score is, always as text (colour and icon only repeat it):
 * «In attesa di invio» on `color.tape`, «Salvato qui, non ancora inviato»
 * on `color.warning`, «Salvato».
 */
export function StatoInvio({
  stato,
  className,
}: {
  stato: StatoVoce;
  className?: string;
}) {
  const { variant, Icon } = ASPETTO[stato];
  return (
    <Badge
      variant={variant}
      icon={<Icon />}
      data-stato={stato}
      className={className}
    >
      {etichettaStato(stato)}
    </Badge>
  );
}
