import { describe, expect, it } from "vitest";
import type { LiveEvent, OverallStandings } from "@/lib/live/types";
import { annuncioClassifica, annuncioEvento } from "./annuncio";

const standings: OverallStandings = {
  id: "M:2026",
  category: "M",
  season: 2026,
  change: "Tappa 3 · Cagliari: punti definitivi",
  rows: [
    {
      playerId: "u1",
      name: "Luca Rossi",
      position: 4,
      points: 32,
      stages: 3,
      provisional: false,
      tied: false,
    },
    {
      playerId: "u2",
      name: "Marco Bianchi",
      position: 5,
      points: 1,
      stages: 1,
      provisional: true,
      tied: true,
    },
  ],
};

describe("annuncio della classifica generale", () => {
  it("una frase sola: cosa è cambiato e la posizione del giocatore", () => {
    expect(annuncioClassifica(standings, "u1")).toBe(
      "Classifica generale maschile aggiornata: Tappa 3 · Cagliari: punti definitivi: la tua posizione: 4ª, 32 punti",
    );
  });

  it("dice pari merito, punti provvisori e il singolare", () => {
    expect(annuncioClassifica({ ...standings, change: null }, "u2")).toBe(
      "Classifica generale maschile aggiornata: la tua posizione: 5ª a pari merito, 1 punto provvisorio",
    );
  });

  it("senza giocatore (o fuori classifica) non dice la posizione", () => {
    expect(annuncioClassifica({ ...standings, change: null }, null)).toBe(
      "Classifica generale maschile aggiornata",
    );
    expect(
      annuncioClassifica({ ...standings, category: "F", change: null }, "zz"),
    ).toBe("Classifica generale femminile aggiornata");
  });

  it("un evento senza classifica per giocatore ha la frase generica", () => {
    const event = {
      seq: 1,
      savedAt: "2026-07-18T10:00:00.000Z",
      type: "overall-standings",
      rows: [],
    } satisfies LiveEvent;
    expect(annuncioEvento(event, "u1")).toBe("Classifica generale aggiornata");
    expect(annuncioEvento({ ...event, standings }, "u1")).toContain("4ª");
  });
});
