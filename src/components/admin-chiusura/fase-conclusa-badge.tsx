import { FlagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FASE_TABELLONE_LABEL } from "@/lib/gironi/fasi/fase";
import { cn } from "cn";

/**
 * «Conclusa» (BLVS-43): a board whose results are closed. Black on tape
 * with a primary border, always with its text; the flag is decoration.
 */
export function FaseConclusaBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="tape"
      data-fase="conclusa"
      className={cn("border-2 border-primary", className)}
    >
      <FlagIcon aria-hidden />
      {FASE_TABELLONE_LABEL.conclusa}
    </Badge>
  );
}
