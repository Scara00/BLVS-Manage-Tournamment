import type { Categoria, SetPunteggio } from "@/lib/db/types";
import { impostaRisultatoLiveDemo } from "./admin-live";
import { creaDemoTappaFinali } from "./avvio-fase";

/**
 * BLVS-43 demo fixtures: a stage in progress whose M and F boards are in
 * the finals (`creaDemoTappaFinali`), with the finals played as asked.
 */

/** One set per round, A always wins with different margins: no tie. */
const SENZA_PARITA: SetPunteggio[][] = [
  [{ a: 21, b: 10 }],
  [{ a: 21, b: 12 }],
  [{ a: 21, b: 14 }],
];
/** A wins every round 21-19: B, C and D end in a perfect tie. */
const CON_PARITA: SetPunteggio[][] = [
  [{ a: 21, b: 19 }],
  [{ a: 21, b: 19 }],
  [{ a: 21, b: 19 }],
];

export const SCENARI_CHIUSURA = [
  "finali_concluse",
  "partita_aperta",
  "parita",
  "da_giocare",
] as const;
export type ScenarioChiusura = (typeof SCENARI_CHIUSURA)[number];

const FINALI = ["finale_gold", "finale_silver"] as const;

function giocaFinali(
  id: string,
  categoria: Categoria,
  scenario: ScenarioChiusura,
) {
  for (const fase of FINALI) {
    const risultati =
      scenario === "parita" && categoria === "M" && fase === "finale_gold"
        ? CON_PARITA
        : SENZA_PARITA;
    risultati.forEach((sets, t) => {
      const partitaId = `${id}-${categoria}-${fase}-t${t + 1}`;
      const aperta =
        scenario === "partita_aperta" &&
        categoria === "M" &&
        fase === "finale_silver" &&
        t === 2;
      impostaRisultatoLiveDemo(
        id,
        categoria,
        partitaId,
        aperta ? [] : sets,
        aperta ? "in_corso" : "conclusa",
      );
    });
  }
}

/** The stage of one scenario; returns its id. */
export function creaDemoChiusura(scenario: ScenarioChiusura): string {
  const id = creaDemoTappaFinali();
  if (scenario === "da_giocare") return id;
  for (const categoria of ["M", "F"] as const) {
    giocaFinali(id, categoria, scenario);
  }
  return id;
}
