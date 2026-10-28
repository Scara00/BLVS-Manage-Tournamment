import { describe, expect, it } from "vitest";
import type { OverallStandings } from "@/lib/live/types";
import { GIOCATORE_ANONIMO, confermaValida } from "./anonimo";
import { anteprimaCancellazione } from "./anteprima";

const classifica: OverallStandings = {
  id: "M:2026",
  category: "M",
  season: 2026,
  rows: [
    {
      playerId: "a",
      name: "Anna Bianchi",
      position: 1,
      points: 24,
      stages: 2,
      provisional: false,
      tied: false,
    },
    {
      playerId: "me",
      name: "Luca Rossi",
      position: 2,
      points: 20,
      stages: 2,
      provisional: true,
      tied: true,
    },
  ],
};

describe("anteprimaCancellazione", () => {
  it("cambia solo il nome: posizione, punti, tappe, provvisori e pari merito restano", () => {
    const anteprima = anteprimaCancellazione(classifica, "me");
    expect(anteprima?.prima).toBe(classifica.rows[1]);
    expect(anteprima?.dopo).toEqual({
      ...classifica.rows[1],
      name: GIOCATORE_ANONIMO,
    });
  });

  it("null per chi non è in classifica", () => {
    expect(anteprimaCancellazione(classifica, "altro")).toBeNull();
  });
});

describe("confermaValida", () => {
  it("accetta ELIMINA, anche minuscolo o con spazi", () => {
    expect(confermaValida("ELIMINA")).toBe(true);
    expect(confermaValida(" elimina ")).toBe(true);
  });

  it("rifiuta tutto il resto", () => {
    for (const v of ["", "ELIMIN", "elimina account", null, 1]) {
      expect(confermaValida(v)).toBe(false);
    }
  });
});
