import { Badge } from "@/components/ui/badge";

/**
 * BLVS-42: a withdrawal or absence in a standing, always as text
 * («Ritirato», «Assente in 1 partita») on color.tape.
 */
export function NotaAssenza({ nota }: { nota: string }) {
  return (
    <Badge variant="tape" data-testid="nota-assenza">
      {nota}
    </Badge>
  );
}
