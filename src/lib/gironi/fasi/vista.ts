import type { Categoria, FaseGioco } from "@/lib/db/types";
import { gironiPath } from "@/lib/tappe/avvio/paths";
import {
  proponiFinali,
  proponiGoldSilver,
  type EsitoProposta,
  type GironeClassificato,
} from "./qualificazione";
import type { ProssimaFaseView, TipoProssimaFase } from "./types";

export type DatiProssimaFase = {
  tappa: { id: string; nome: string };
  categoria: Categoria;
  faseGioco: FaseGioco | null;
  /** A gold/silver proposal exists and isn't started. */
  proposta: boolean;
  /** The groups of the phase just played, with their standings. */
  gironi: GironeClassificato[];
};

/**
 * Where «Risolvi parità» leads: the tied group's card in the groups
 * editor (BLVS-28's `#girone-<id>` anchor), where BLVS-38 shows the tie
 * and its resolution.
 */
export function risolviParitaHref(
  tappaId: string,
  categoria: Categoria,
  gironeId: string,
): string {
  return `${gironiPath(tappaId, categoria)}#girone-${encodeURIComponent(gironeId)}`;
}

/**
 * What the next-phase panel shows for one board, or null when the step
 * doesn't apply yet (or any more): the gold/silver proposal while the
 * initial groups are in play, the finals once gold/silver are.
 */
export function vistaProssimaFase(
  tipo: TipoProssimaFase,
  dati: DatiProssimaFase,
): ProssimaFaseView | null {
  const base = {
    tappa: dati.tappa,
    categoria: dati.categoria,
    tipo,
    faseGioco: dati.faseGioco,
    gironi: [],
    messaggio: null,
    anteprima: [],
    avvisi: [],
  };

  let esito: EsitoProposta;
  if (tipo === "gold_silver") {
    if (dati.faseGioco !== "gironi_iniziali") return null;
    if (dati.proposta) return { ...base, stato: "proposta" };
    esito = proponiGoldSilver(dati.gironi);
  } else {
    if (dati.faseGioco === "finali") return { ...base, stato: "fatta" };
    if (dati.faseGioco !== "gironi_gold_silver") return null;
    esito = proponiFinali(dati.gironi);
  }

  switch (esito.esito) {
    case "in_corso":
    case "parita":
      return {
        ...base,
        stato: esito.esito,
        gironi: esito.gironi.map((g) => ({
          ...g,
          href: risolviParitaHref(dati.tappa.id, dati.categoria, g.id),
        })),
      };
    case "non_componibile":
      return { ...base, stato: "non_componibile", messaggio: esito.messaggio };
    case "ok":
      return {
        ...base,
        stato: "pronta",
        anteprima: esito.gironi,
        avvisi: esito.avvisi,
      };
  }
}
