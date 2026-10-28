import { describe, expect, it } from "vitest";
import {
  applicaRegola,
  REGOLA_RITIRO,
  spiegaRegolaRitiro,
  type RegolaRitiro,
} from "./regola";

const partita = {
  stato: "conclusa" as const,
  sets: [{ a: 21, b: 18 }],
  squadre: { A: ["rossi", "bianchi"], B: ["marino", "greco"] },
};

describe("regola del ritiro (Q-09)", () => {
  it("per ora annulla la partita, anche se conclusa, e ne toglie il punteggio", () => {
    expect(REGOLA_RITIRO.esito).toBe("annulla");
    expect(applicaRegola(partita, "rossi")).toEqual({
      stato: "annullata",
      sets: [],
    });
  });

  it("a tavolino perde la coppia del giocatore, da qualunque lato", () => {
    const tavolino: RegolaRitiro = {
      esito: "tavolino",
      puntiVincitore: 21,
      puntiPerdente: 0,
    };
    expect(applicaRegola(partita, "bianchi", tavolino)).toEqual({
      stato: "conclusa",
      sets: [{ a: 0, b: 21 }],
    });
    expect(applicaRegola(partita, "greco", tavolino)).toEqual({
      stato: "conclusa",
      sets: [{ a: 21, b: 0 }],
    });
  });

  it("spiega la regola a parole", () => {
    expect(spiegaRegolaRitiro()).toMatch(/annullata/);
    expect(
      spiegaRegolaRitiro({
        esito: "tavolino",
        puntiVincitore: 21,
        puntiPerdente: 0,
      }),
    ).toMatch(/0–21 a tavolino/);
  });
});
