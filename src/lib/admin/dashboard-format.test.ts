import { describe, expect, it } from "vitest";
import { toIscrizioneInAttesa } from "./dashboard-format";

describe("toIscrizioneInAttesa", () => {
  it("mostra giocatore, tappa e giorno di ricezione (ora di Roma)", () => {
    expect(
      toIscrizioneInAttesa({
        id: "i1",
        created_at: "2026-06-11T22:30:00Z",
        utente: { nome: "Giulia", cognome: "Rossi" },
        tappa: { nome: "Tappa 2 · Rimini" },
      }),
    ).toEqual({
      id: "i1",
      player: "Giulia Rossi",
      stage: "Tappa 2 · Rimini",
      received: "12 giugno",
    });
  });

  it("regge un profilo senza nome", () => {
    const row = toIscrizioneInAttesa({
      id: "i2",
      created_at: "2026-06-11T10:00:00Z",
      utente: { nome: "", cognome: "" },
      tappa: null,
    });
    expect(row.player).toBe("Giocatore senza nome");
    expect(row.stage).toBe("—");
  });
});
