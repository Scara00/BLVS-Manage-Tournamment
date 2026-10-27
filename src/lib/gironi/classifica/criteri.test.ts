import { describe, expect, it } from "vitest";
import {
  CRITERI,
  CRITERI_SPAREGGIO,
  REGOLA_CLASSIFICA,
  SPIEGAZIONE_PARITA_PERFETTA,
  spiegaRegolaClassifica,
} from "./criteri";

describe("criteri di spareggio", () => {
  it("ogni criterio ha etichetta e spiegazione", () => {
    for (const id of CRITERI_SPAREGGIO) {
      expect(CRITERI[id].id).toBe(id);
      expect(CRITERI[id].etichetta.trim()).not.toBe("");
      expect(CRITERI[id].spiegazione.trim()).not.toBe("");
    }
  });

  it("la regola usa ogni criterio una sola volta (Q-03)", () => {
    expect(REGOLA_CLASSIFICA.criteri).toEqual([
      "vittorie",
      "scontro_diretto",
      "differenza_punti",
      "punti_fatti",
    ]);
    expect(new Set(REGOLA_CLASSIFICA.criteri).size).toBe(
      REGOLA_CLASSIFICA.criteri.length,
    );
  });

  it("il testo per la pagina delle regole segue l'ordine dei criteri", () => {
    expect(
      spiegaRegolaClassifica({ criteri: ["punti_fatti", "vittorie"] }),
    ).toEqual([
      CRITERI.punti_fatti.spiegazione,
      CRITERI.vittorie.spiegazione,
      SPIEGAZIONE_PARITA_PERFETTA,
    ]);
  });
});
