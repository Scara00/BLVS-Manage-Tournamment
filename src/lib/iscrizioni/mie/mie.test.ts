import { describe, expect, it } from "vitest";
import type { RigaGenerale } from "@/lib/classifica-generale/types";
import {
  dividiIscrizioni,
  quandoTappa,
  riepilogoStagione,
  risultatoDaClassifica,
  toIscrizioneMia,
  type IscrizioneMiaRow,
} from "./mie";

const AT = new Date("2027-06-01T10:00:00Z");

function row(over: Partial<IscrizioneMiaRow> = {}): IscrizioneMiaRow {
  return {
    id: "i1",
    stato: "in_attesa",
    posto: 12,
    categoria: "M",
    inGirone: false,
    ...over,
    tappa: {
      id: "t1",
      nome: "Tappa 2 · Rimini",
      luogo: "Rimini, Bagno 26",
      data_inizio: "2027-06-26",
      data_fine: "2027-06-27",
      stato: "iscrizioni_aperte",
      stagione: 2027,
      iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
      annullabile_fino_al: null,
      ...over.tappa,
    },
  };
}

const RIGHE: RigaGenerale[] = [
  {
    utenteId: "me",
    nome: "Luca Rossi",
    posizione: 2,
    punti: 20,
    tappeGiocate: 2,
    puntiProvvisori: true,
    pariMerito: false,
    anonimo: false,
    tappe: [
      {
        tappaId: "t0",
        nome: "Tappa 1",
        data: "2027-05-10",
        posizione: 1,
        punti: 12,
        provvisori: false,
        fase: "gold",
        posizioneDefinitiva: true,
      },
    ],
  },
  {
    utenteId: "altro",
    nome: "Marco Bianchi",
    posizione: 1,
    punti: 24,
    tappeGiocate: 2,
    puntiProvvisori: false,
    pariMerito: false,
    anonimo: false,
    tappe: [],
  },
];

describe("quandoTappa", () => {
  it("passata se conclusa, archiviata o finita prima di oggi (Roma)", () => {
    expect(
      quandoTappa({ stato: "conclusa", data_fine: "2099-01-01" }, AT),
    ).toBe("passata");
    expect(
      quandoTappa({ stato: "iscrizioni_chiuse", data_fine: "2027-05-31" }, AT),
    ).toBe("passata");
    expect(
      quandoTappa({ stato: "in_corso", data_fine: "2027-06-01" }, AT),
    ).toBe("prossima");
  });
});

describe("toIscrizioneMia", () => {
  it("stato a testo, posto e azione di annullamento con la scadenza", () => {
    const mia = toIscrizioneMia(row(), null, AT);
    expect(mia).toMatchObject({
      statoTesto: "Iscritto",
      tono: "attiva",
      posto: 12,
      quando: "prossima",
      risultato: null,
    });
    expect(mia.annullamento).toMatchObject({
      possibile: true,
      iscrizioneId: "i1",
      scadenzaIso: "2027-06-19T21:59:00.000Z",
    });
  });

  it("un'iscrizione annullata non ha azione né risultato", () => {
    const mia = toIscrizioneMia(
      row({ stato: "ritirata" }),
      { posizione: 1, punti: 12, provvisori: false },
      AT,
    );
    expect(mia.statoTesto).toBe("Iscrizione annullata");
    expect(mia.tono).toBe("annullata");
    expect(mia.annullamento).toBeNull();
    expect(mia.risultato).toBeNull();
  });

  it("dopo la scadenza l'azione manca e c'è il perché", () => {
    const mia = toIscrizioneMia(row(), null, new Date("2027-06-20T08:00:00Z"));
    expect(mia.annullamento).toMatchObject({
      possibile: false,
      motivo: "scadenza_superata",
    });
    expect(mia.annullamento?.motivoTesto).toMatch(/scadenza era il 19 giugno/);
  });

  it("risultato di una tappa giocata, provvisorio finché il tabellone è aperto", () => {
    const mia = toIscrizioneMia(
      row({ tappa: { stato: "conclusa" } as IscrizioneMiaRow["tappa"] }),
      { posizione: 2, punti: 8, provvisori: true },
      AT,
    );
    expect(mia.risultatoTesto).toBe("2° posto · 8 punti (provvisori)");
    expect(
      toIscrizioneMia(
        row({ tappa: { stato: "conclusa" } as IscrizioneMiaRow["tappa"] }),
        { posizione: null, punti: 0, provvisori: false },
        AT,
      ).risultatoTesto,
    ).toBe("Fuori prima delle finali · 0 punti");
  });

  it("una tappa annullata lo dice a testo", () => {
    expect(
      toIscrizioneMia(
        row({ tappa: { stato: "annullata" } as IscrizioneMiaRow["tappa"] }),
        null,
        AT,
      ).statoTesto,
    ).toBe("Tappa annullata");
  });
});

describe("dividiIscrizioni", () => {
  it("prossime dalla più vicina, passate dalla più recente", () => {
    const a = toIscrizioneMia(
      row({
        id: "a",
        tappa: {
          data_inizio: "2027-07-10",
          data_fine: "2027-07-11",
        } as IscrizioneMiaRow["tappa"],
      }),
      null,
      AT,
    );
    const b = toIscrizioneMia(
      row({
        id: "b",
        tappa: {
          data_inizio: "2027-06-20",
          data_fine: "2027-06-21",
        } as IscrizioneMiaRow["tappa"],
      }),
      null,
      AT,
    );
    const c = toIscrizioneMia(
      row({
        id: "c",
        tappa: {
          data_inizio: "2027-04-01",
          data_fine: "2027-04-02",
        } as IscrizioneMiaRow["tappa"],
      }),
      null,
      AT,
    );
    const d = toIscrizioneMia(
      row({
        id: "d",
        tappa: {
          data_inizio: "2027-05-01",
          data_fine: "2027-05-02",
        } as IscrizioneMiaRow["tappa"],
      }),
      null,
      AT,
    );
    const { prossime, passate } = dividiIscrizioni([a, b, c, d]);
    expect(prossime.map((i) => i.id)).toEqual(["b", "a"]);
    expect(passate.map((i) => i.id)).toEqual(["d", "c"]);
  });
});

describe("riepilogo della stagione (classifica di BLVS-44)", () => {
  it("punti, tappe e posizione del giocatore", () => {
    expect(
      riepilogoStagione({ stagione: 2027, categoria: "M", righe: RIGHE }, "me"),
    ).toEqual({
      stagione: 2027,
      categoria: "M",
      punti: 20,
      tappeGiocate: 2,
      posizione: 2,
      pariMerito: false,
      provvisori: true,
      giocatori: 2,
    });
  });

  it("chi non è in classifica ha zero e nessuna posizione", () => {
    expect(
      riepilogoStagione({ stagione: 2027, categoria: "M", righe: RIGHE }, "x"),
    ).toMatchObject({ punti: 0, tappeGiocate: 0, posizione: null });
  });

  it("risultato di una tappa dalla riga del giocatore", () => {
    expect(risultatoDaClassifica(RIGHE, "me", "t0")).toEqual({
      posizione: 1,
      punti: 12,
      provvisori: false,
    });
    expect(risultatoDaClassifica(RIGHE, "me", "t9")).toBeNull();
  });
});
