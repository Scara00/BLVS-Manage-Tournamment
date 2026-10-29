import { describe, expect, it } from "vitest";
import type { OverallStandings } from "@/lib/live/types";
import { confermaValida } from "./anonimo";
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
  it("è la riga del giocatore, quella che la cancellazione toglie", () => {
    expect(anteprimaCancellazione(classifica, "me")).toEqual({
      attuale: classifica.rows[1],
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
