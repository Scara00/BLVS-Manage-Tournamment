import { describe, expect, it } from "vitest";
import { girone, partiteGirone } from "@/components/admin-ritiro/stories-data";
import {
  anteprimaRitiro,
  classificaRitiro,
  cosaCambiaRitiro,
  descriviCambio,
  giocatoriGirone,
  partiteDelGiocatore,
  preselezione,
} from "./anteprima";

const ROSSI = "i-Rossi";

describe("anteprima del ritiro", () => {
  it("elenca i giocatori del girone per cognome", () => {
    expect(giocatoriGirone(partiteGirone).map((g) => g.nome)).toEqual([
      "Bianchi Luca",
      "Greco Luca",
      "Marino Luca",
      "Rossi Luca",
    ]);
  });

  it("un ritiro sceglie le partite non concluse, un'assenza nessuna", () => {
    const scelte = partiteDelGiocatore(partiteGirone, ROSSI);
    expect(preselezione("ritiro", scelte)).toEqual(["g1-t2", "g1-t3"]);
    expect(preselezione("assenza", scelte)).toEqual([]);
  });

  it("una partita già registrata o annullata non si sceglie", () => {
    const partite = partiteGirone.map((p) =>
      p.turno === 3 ? { ...p, stato: "annullata" as const } : p,
    );
    const scelte = partiteDelGiocatore(partite, ROSSI, [
      { partitaId: "g1-t2", iscrizioneId: ROSSI, tipo: "assenza" },
    ]);
    expect(scelte.map((s) => [s.disponibile, s.motivo])).toEqual([
      [true, null],
      [false, "già registrata"],
      [false, "annullata"],
    ]);
    expect(preselezione("ritiro", scelte)).toEqual([]);
  });

  it("mostra il risultato prima e dopo la regola", () => {
    expect(anteprimaRitiro(partiteGirone, ROSSI, ["g1-t1", "g1-t2"])).toEqual([
      {
        partitaId: "g1-t1",
        partita: `${girone.nome} · turno 1`,
        prima: "21–18",
        dopo: "annullata",
        sovrascrive: true,
      },
      {
        partitaId: "g1-t2",
        partita: `${girone.nome} · turno 2`,
        prima: "da giocare",
        dopo: "annullata",
        sovrascrive: false,
      },
    ]);
  });

  it("ricalcola la classifica senza le partite annullate", () => {
    const { prima, dopo } = classificaRitiro(partiteGirone, ROSSI, ["g1-t1"]);
    const rossiPrima = prima.righe.find((r) => r.iscrizioneId === ROSSI)!;
    const rossiDopo = dopo.righe.find((r) => r.iscrizioneId === ROSSI)!;
    expect(rossiPrima).toMatchObject({ giocate: 1, vinte: 1, posizione: 1 });
    expect(rossiDopo).toMatchObject({ giocate: 0, vinte: 0 });
    // Nobody has played a match that counts any more.
    expect(dopo.righe.every((r) => r.giocate === 0)).toBe(true);

    const cambi = cosaCambiaRitiro(partiteGirone, ROSSI, ["g1-t1"]);
    const rossi = cambi.find((c) => c.iscrizioneId === ROSSI)!;
    expect(rossi).toMatchObject({ prima: 1, vinteDopo: 0, giocateDopo: 0 });
    expect(descriviCambio({ ...rossi, prima: 1, dopo: 1 })).toBe("resta 1ª");
    expect(descriviCambio({ ...rossi, prima: 1, dopo: 3 })).toBe("da 1ª a 3ª");
  });

  it("le partite ancora da giocare non cambiano la classifica", () => {
    const { prima, dopo } = classificaRitiro(partiteGirone, ROSSI, [
      "g1-t2",
      "g1-t3",
    ]);
    expect(dopo.righe).toEqual(prima.righe);
    // The group is finished once the other matches are voided: Rossi and
    // Bianchi, who won together, are now a perfect tie.
    expect(dopo.stato).toBe("da_risolvere");
    expect(prima.stato).toBe("in_corso");
  });
});
