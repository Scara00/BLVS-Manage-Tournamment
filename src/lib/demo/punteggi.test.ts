import { beforeEach, describe, expect, it } from "vitest";
import { FINESTRA_ANNULLAMENTO_SECONDI } from "@/lib/punteggi/regola";
import {
  annullaPunteggioDemo,
  classificaDemo,
  creaDemoPunteggi,
  getDemoPunteggi,
  salvaPunteggioDemo,
} from "./punteggi";

let tappa: string;

function partita(i = 0) {
  return getDemoPunteggi(tappa)!.partite[i];
}

beforeEach(() => {
  tappa = creaDemoPunteggi();
});

describe("partite demo", () => {
  it("ha le 3 partite di ogni girone avviato, tutte da inserire", () => {
    const { tappa: t, partite } = getDemoPunteggi(tappa)!;
    expect(t.stato).toBe("in_corso");
    expect(partite).toHaveLength(6);
    expect(partite.every((p) => p.stato === "programmata")).toBe(true);
    expect(partite[0].squadre.a).toHaveLength(2);
    expect(partite[0].squadre.b).toHaveLength(2);
  });
});

describe("salvataggio e annullamento", () => {
  it("salva il set e conclude la partita, poi lo corregge", () => {
    const p = partita();
    expect(salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 18 }, 0)).toEqual({
      status: "ok",
      versione: 2,
      tipo: "inserimento",
      scelta: null,
      punteggiPersi: 0,
    });
    expect(partita()).toMatchObject({
      stato: "conclusa",
      sets: [{ a: 21, b: 18 }],
      versione: 2,
    });
    expect(salvaPunteggioDemo(tappa, p.id, 2, { a: 18, b: 21 }, 0)).toEqual({
      status: "ok",
      versione: 3,
      tipo: "correzione",
      scelta: null,
      punteggiPersi: 0,
    });
  });

  it("rifiuta un punteggio non valido e una versione superata", () => {
    const p = partita();
    expect(salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 20 }, 0)).toEqual({
      status: "nonValido",
      codice: "regola_set",
    });
    salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 18 }, 0);
    expect(salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 15 }, 0)).toEqual({
      status: "versioneSuperata",
    });
  });

  it("annulla rimette punteggio e stato di prima", () => {
    const p = partita();
    salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 18 }, 1000);
    expect(annullaPunteggioDemo(tappa, p.id, 2, 11_000)).toEqual({
      status: "ok",
      versione: 3,
    });
    expect(partita()).toMatchObject({
      stato: "programmata",
      sets: [],
      versione: 3,
    });
    expect(annullaPunteggioDemo(tappa, p.id, 3, 12_000)).toEqual({
      status: "cambiato",
    });
  });

  it("non annulla dopo una modifica successiva né oltre la finestra", () => {
    const p = partita();
    salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 18 }, 0);
    salvaPunteggioDemo(tappa, p.id, 2, { a: 21, b: 16 }, 0);
    expect(annullaPunteggioDemo(tappa, p.id, 2, 0).status).toBe("cambiato");
    expect(
      annullaPunteggioDemo(
        tappa,
        p.id,
        3,
        FINESTRA_ANNULLAMENTO_SECONDI * 1000 + 1,
      ).status,
    ).toBe("scaduto");
  });
});

describe("ricalcolo della classifica", () => {
  it("il salvataggio aggiorna la classifica e l'annullamento la riporta", () => {
    const p = partita();
    const prima = classificaDemo(tappa, p.gironeId)!;
    expect(prima.righe.every((r) => r.giocate === 0)).toBe(true);

    salvaPunteggioDemo(tappa, p.id, 1, { a: 21, b: 18 }, 0);
    const dopo = classificaDemo(tappa, p.gironeId)!;
    const vincitori = p.squadre.a.map((g) => g.iscrizioneId);
    for (const riga of dopo.righe) {
      expect(riga.giocate).toBe(1);
      expect(riga.vinte).toBe(vincitori.includes(riga.iscrizioneId) ? 1 : 0);
    }
    expect(
      dopo.righe
        .slice(0, 2)
        .map((r) => r.iscrizioneId)
        .sort(),
    ).toEqual([...vincitori].sort());

    annullaPunteggioDemo(tappa, p.id, 2, 0);
    expect(classificaDemo(tappa, p.gironeId)).toEqual(prima);
  });
});
