import { describe, expect, it } from "vitest";
import { classificaTappa } from "./classifica";
import { faseDellaFinale, toFinaliTappa, type DatiFinali } from "./dati";

describe("faseDellaFinale", () => {
  it("riconosce le finali gold e silver", () => {
    expect(faseDellaFinale("finale_gold")).toBe("gold");
    expect(faseDellaFinale("finale_silver")).toBe("silver");
  });

  it("esclude i gironi che non sono finali", () => {
    for (const fase of ["iniziale", "gold", "silver", null]) {
      expect(faseDellaFinale(fase)).toBeUndefined();
    }
  });
});

const utente = (nome: string) => ({ nome, cognome: "Rossi" });

/** Final of a, b, c, d; d withdrew and left the group, but played. */
const DATI: DatiFinali = {
  gironi: [
    { id: "g1", fase: "gold" },
    { id: "f1", fase: "finale_gold" },
  ],
  membri: ["a", "b", "c"].map((id) => ({ girone_id: "f1", iscrizione_id: id })),
  partite: [
    {
      id: "p1",
      girone_id: "f1",
      stato: "conclusa",
      punteggi: { sets: [{ a: 21, b: 15 }] },
      partita_giocatori: [
        { iscrizione_id: "a", squadra: "A" },
        { iscrizione_id: "b", squadra: "A" },
        { iscrizione_id: "c", squadra: "B" },
        { iscrizione_id: "d", squadra: "B" },
      ],
    },
  ],
  iscrizioni: [
    { id: "a", stato: "confermata", utente: utente("Anna") },
    { id: "b", stato: "confermata", utente: [utente("Bruno")] },
    { id: "c", stato: "confermata", utente: null },
    { id: "d", stato: "ritirata", utente: utente("Dario") },
  ],
  decisioni: [{ girone_id: "f1", firma: "x", ordine: ["a"] }],
};

describe("toFinaliTappa", () => {
  it("costruisce solo le finali, con membri, giocatori e ritirati", () => {
    const [finale, ...altre] = toFinaliTappa(DATI);
    expect(altre).toHaveLength(0);
    expect(finale.gironeId).toBe("f1");
    expect(finale.fase).toBe("gold");
    expect(finale.giocatori).toEqual([
      { iscrizioneId: "a", nome: "Anna Rossi", ritirato: false },
      { iscrizioneId: "b", nome: "Bruno Rossi", ritirato: false },
      { iscrizioneId: "c", nome: "c", ritirato: false },
      { iscrizioneId: "d", nome: "Dario Rossi", ritirato: true },
    ]);
    expect(finale.partite[0].squadre).toEqual({
      A: ["a", "b"],
      B: ["c", "d"],
    });
    expect(finale.decisioni).toEqual([{ firma: "x", ordine: ["a"] }]);
  });

  it("mette il ritirato all'ultimo posto della classifica di tappa", () => {
    const c = classificaTappa({ finali: toFinaliTappa(DATI), concluso: false });
    expect(c.righe.at(-1)).toMatchObject({
      iscrizioneId: "d",
      posizione: 4,
      punti: 2,
      ritirato: true,
    });
  });
});
