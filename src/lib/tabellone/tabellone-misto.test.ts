import { describe, expect, it } from "vitest";
import { datiDaRpc, vistaTabellone, type RpcTabellone } from "./dati";
import { posizioneEstesa } from "./posizione";

/** A mixed board with one initial group of 2 men + 2 women, played. */
function rpc(): RpcTabellone {
  const partita = (id: string, a: string[], b: string[]) => ({
    id,
    girone_id: "g1",
    stato: "conclusa" as const,
    punteggi: { sets: [{ a: 21, b: 15 }] },
    partita_giocatori: [
      ...a.map((iscrizione_id) => ({ iscrizione_id, squadra: "A" as const })),
      ...b.map((iscrizione_id) => ({ iscrizione_id, squadra: "B" as const })),
    ],
  });
  return {
    tappa: { id: "t", nome: "K&Q", stato: "in_corso" },
    tabelloni: [
      {
        id: "x",
        categoria: "X",
        fase_gioco: "gironi_iniziali",
        concluso_il: null,
      },
    ],
    gironi: [
      {
        id: "g1",
        tabellone_id: "x",
        nome: "Girone A",
        posizione: 1,
        fase: "iniziale",
      },
    ],
    membri: ["m1", "m2", "f1", "f2"].map((iscrizione_id) => ({
      girone_id: "g1",
      iscrizione_id,
    })),
    // m1 e f1 sempre insieme e sempre vincenti: in una classifica unica
    // sarebbero pari perfetti.
    partite: [
      partita("p1", ["m1", "f1"], ["m2", "f2"]),
      partita("p2", ["m1", "f1"], ["m2", "f2"]),
    ],
    decisioni: [],
    nomi: [
      { iscrizione_id: "m1", nome: "Mario", cognome: "Uno", categoria: "M" },
      { iscrizione_id: "m2", nome: "Marco", cognome: "Due", categoria: "M" },
      { iscrizione_id: "f1", nome: "Anna", cognome: "Uno", categoria: "F" },
      { iscrizione_id: "f2", nome: "Bea", cognome: "Due", categoria: "F" },
    ],
    assenze: [],
  };
}

describe("tabellone misto: uomini e donne a parte", () => {
  const vista = vistaTabellone(datiDaRpc(rpc()), {
    updatedAt: "2027-06-01T10:00:00Z",
  });
  const girone = vista.boards[0].gironi[0];

  it("ogni categoria ha i suoi posti e nessuna parità uomo-donna", () => {
    expect(
      girone.rows.map((r) => [r.playerId, r.category, r.position, r.pari]),
    ).toEqual([
      ["m1", "M", 1, false],
      ["m2", "M", 2, false],
      ["f1", "F", 1, false],
      ["f2", "F", 2, false],
    ]);
    expect(girone.stato).toBe("completo");
  });

  it("la linea gold è dopo il 2° di ogni categoria", () => {
    expect(girone.taglio).toMatchObject({ dopo: 2, sopra: "gironi gold" });
  });

  it("la posizione si legge con la categoria", () => {
    expect(posizioneEstesa(girone.rows[2])).toBe("1° tra le donne");
    expect(posizioneEstesa({ position: 2, pari: false })).toBe("2°");
  });

  it("prima di qualsiasi risultato: uomini poi donne, per nome", () => {
    const vuoto = { ...rpc(), partite: [] };
    const righe = vistaTabellone(datiDaRpc(vuoto), {
      updatedAt: "2027-06-01T10:00:00Z",
    }).boards[0].gironi[0].rows;
    expect(righe.map((r) => [r.playerId, r.category])).toEqual([
      ["m2", "M"], // Marco Due
      ["m1", "M"], // Mario Uno
      ["f1", "F"], // Anna Uno
      ["f2", "F"], // Bea Due
    ]);
  });
});
