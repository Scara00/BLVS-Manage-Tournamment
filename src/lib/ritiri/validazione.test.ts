import { describe, expect, it } from "vitest";
import {
  notaAssenze,
  noteAssenze,
  esitoRitiro,
  etichettaRegistra,
} from "./format";
import { campoPartita, validaRitiro } from "./validazione";

describe("validaRitiro", () => {
  it("segnala ogni campo mancante", () => {
    const esito = validaRitiro({ iscrizioneId: "", tipo: null, partite: [] });
    expect(esito).toEqual({
      ok: false,
      errori: {
        giocatore: "Scegli il giocatore.",
        tipo: "Scegli se è un ritiro o un'assenza.",
        partite: "Scegli almeno una partita.",
      },
    });
  });

  it("legge le partite con la versione vista", () => {
    const esito = validaRitiro({
      iscrizioneId: "i1",
      tipo: "assenza",
      partite: [campoPartita("p1", 2), campoPartita("p2", 1)],
    });
    expect(esito).toEqual({
      ok: true,
      dati: {
        iscrizioneId: "i1",
        tipo: "assenza",
        partite: [
          { partitaId: "p1", versione: 2 },
          { partitaId: "p2", versione: 1 },
        ],
      },
    });
  });

  it("rifiuta una partita malformata", () => {
    const esito = validaRitiro({
      iscrizioneId: "i1",
      tipo: "ritiro",
      partite: ["p1"],
    });
    expect(esito.ok).toBe(false);
  });
});

describe("testi del ritiro", () => {
  it("la classifica lo dice a parole", () => {
    expect(notaAssenze([])).toBeNull();
    expect(notaAssenze([{ tipo: "assenza" }])).toBe("Assente in 1 partita");
    expect(notaAssenze([{ tipo: "assenza" }, { tipo: "assenza" }])).toBe(
      "Assente in 2 partite",
    );
    expect(notaAssenze([{ tipo: "assenza" }, { tipo: "ritiro" }])).toBe(
      "Ritirato",
    );
    expect(
      noteAssenze([
        { partitaId: "p1", iscrizioneId: "a", tipo: "ritiro" },
        { partitaId: "p2", iscrizioneId: "b", tipo: "assenza" },
      ]),
    ).toEqual(
      new Map([
        ["a", "Ritirato"],
        ["b", "Assente in 1 partita"],
      ]),
    );
  });

  it("annuncia l'esito", () => {
    expect(etichettaRegistra("ritiro", 2)).toBe(
      "Registra il ritiro (2 partite)",
    );
    expect(etichettaRegistra(null, 0)).toBe("Registra ritiro o assenza");
    expect(
      esitoRitiro({
        tipo: "assenza",
        nome: "Rossi Luca",
        n: 1,
        scelta: "rigenera",
        punteggiPersi: 1,
      }),
    ).toBe(
      "Assenza registrata per Rossi Luca: 1 partita annullata. La classifica del girone è ricalcolata e l'operazione è nel registro. La fase successiva è stata eliminata e va generata di nuovo: perso 1 punteggio, annotati nel registro.",
    );
  });
});

describe("classifica pubblicata (live)", () => {
  it("porta la nota del ritiro accanto al nome", async () => {
    const { toGroupStandings } = await import("@/lib/punteggi/format");
    const { classificaGirone } = await import("@/lib/gironi/classifica");
    const gruppo = toGroupStandings(
      { id: "g1", nome: "Girone A" },
      classificaGirone(["a", "b"], []),
      new Map([
        ["a", "Rossi Luca"],
        ["b", "Bianchi Luca"],
      ]),
      { stageId: "jesolo", category: "M" },
      noteAssenze([{ partitaId: "p1", iscrizioneId: "a", tipo: "ritiro" }]),
    );
    expect(gruppo.rows.find((r) => r.playerId === "a")?.note).toBe("Ritirato");
    expect(gruppo.rows.find((r) => r.playerId === "b")).not.toHaveProperty(
      "note",
    );
  });
});
