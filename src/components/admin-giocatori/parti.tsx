import { BadgeCheckIcon, CircleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Categoria, Ruolo } from "@/lib/db/types";
import { CATEGORIA_LABEL } from "@/lib/tappe/dettaglio";

export function CategoriaGiocatore({
  categoria,
}: {
  categoria: Categoria | null;
}) {
  return categoria ? (
    <span data-categoria={categoria}>{CATEGORIA_LABEL[categoria]}</span>
  ) : (
    <span className="text-muted-foreground">Non indicata</span>
  );
}

/** «Da verificare» on color.tape, as text (never colour alone). */
export function StatoVerifica({
  daVerificare,
  ruolo,
}: {
  daVerificare: boolean;
  ruolo: Ruolo;
}) {
  if (ruolo === "admin") return <Badge variant="neutral">Admin</Badge>;
  return daVerificare ? (
    <Badge
      variant="tape"
      icon={<CircleAlertIcon />}
      data-verifica="da-verificare"
    >
      Da verificare
    </Badge>
  ) : (
    <Badge
      variant="success"
      icon={<BadgeCheckIcon />}
      data-verifica="verificata"
    >
      Verificata
    </Badge>
  );
}
