import type { Categoria, StatoTappa } from "@/lib/db/types";
import { formatScadenza } from "@/lib/tappe/format";

/** Why «Prendi il posto» is disabled, most important first. */
export const MOTIVI_BLOCCO = [
  "annullata",
  "gia_iscritto",
  "chiuse",
  "scadute",
  "categoria_mancante",
  "esaurite",
] as const;

export type MotivoBlocco = (typeof MOTIVI_BLOCCO)[number];

export type Iscrivibilita = {
  stato: StatoTappa;
  /** ISO instants; null = no limit on that side. */
  aprono: string | null;
  chiudono: string | null;
  categoria: Categoria | null;
  /** Free seats on the player's board; null when unknown. */
  liberi: number | null;
  iscritto: boolean;
};

/**
 * The reason the player cannot take a seat now, or null when they can.
 * `at` is always the server clock (`now()` from `@/lib/time/server-time`):
 * deadlines are absolute instants, Europe/Rome only matters for display.
 * The database repeats every check (trigger `iscrizioni_posti`).
 */
export function motivoBlocco(
  input: Iscrivibilita,
  at: Date,
): MotivoBlocco | null {
  if (input.stato === "annullata") return "annullata";
  if (input.iscritto) return "gia_iscritto";
  if (input.stato !== "iscrizioni_aperte") return "chiuse";
  if (input.aprono && new Date(input.aprono) > at) return "chiuse";
  if (input.chiudono && new Date(input.chiudono) <= at) return "scadute";
  if (!input.categoria) return "categoria_mancante";
  if (input.liberi !== null && input.liberi <= 0) return "esaurite";
  return null;
}

/** The text linked to the disabled button (`aria-describedby`). */
export function testoMotivo(
  motivo: MotivoBlocco,
  {
    chiudono,
    aprono,
  }: { chiudono?: string | null; aprono?: string | null } = {},
): string {
  switch (motivo) {
    case "annullata":
      return "La tappa è stata annullata: non si accettano iscrizioni.";
    case "gia_iscritto":
      return "Sei già iscritto a questa tappa.";
    case "chiuse":
      return aprono
        ? `Le iscrizioni non sono aperte: aprono il ${formatScadenza(aprono)}.`
        : "Le iscrizioni a questa tappa sono chiuse.";
    case "scadute":
      return chiudono
        ? `Le iscrizioni sono scadute il ${formatScadenza(chiudono)}.`
        : "Le iscrizioni a questa tappa sono scadute.";
    case "categoria_mancante":
      return "Indica la tua categoria nel profilo per prendere un posto.";
    case "esaurite":
      return "Posti esauriti nella tua categoria.";
  }
}
