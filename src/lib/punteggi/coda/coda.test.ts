import { describe, expect, it } from "vitest";
import {
  annuncioCambio,
  applicaEsito,
  daInviare,
  nuovaVoce,
  riassuntoCoda,
  riprendi,
  scaduti,
  seguitiDa,
  SALVATI_VISIBILI_MS,
  sostituite,
  tieniIlMio,
} from "./coda";
import type { VoceCoda } from "./types";

const T0 = new Date("2027-06-12T10:00:00Z");
const PARTITA = "11111111-1111-4111-8111-111111111111";

function voce(over: Partial<VoceCoda> = {}): VoceCoda {
  return {
    ...nuovaVoce(
      {
        partitaId: PARTITA,
        versione: 1,
        sets: [{ a: 21, b: 18 }],
        etichetta: "Girone A · turno 1",
        path: "/admin",
      },
      { autoreId: "admin-1", now: T0 },
    ),
    ...over,
  };
}

describe("nuovaVoce", () => {
  it("nasce in attesa di invio con una chiave sua", () => {
    const a = voce();
    const b = voce();
    expect(a.stato).toBe("in_attesa");
    expect(a.chiave).not.toBe(b.chiave);
    expect(a.chiave).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("sostituite", () => {
  it("un punteggio riscritto prende il posto di quello in attesa", () => {
    const vecchia = voce();
    const nuova = voce({ sets: [{ a: 21, b: 15 }] });
    expect(sostituite([vecchia], nuova)).toEqual([vecchia]);
  });

  it("non tocca quello già in volo né le altre partite", () => {
    const inVolo = voce({ stato: "invio" });
    const altra = voce({ partitaId: "altra" });
    expect(sostituite([inVolo, altra], voce())).toEqual([]);
  });
});

describe("daInviare", () => {
  const opts = { autoreId: "admin-1", now: T0, forza: false };

  it("rispetta l'attesa tra i tentativi, salvo quando si forza", () => {
    const dopo = voce({
      prossimoTentativo: new Date(T0.getTime() + 5000).toISOString(),
    });
    expect(daInviare([dopo], opts)).toEqual([]);
    expect(daInviare([dopo], { ...opts, forza: true })).toEqual([dopo]);
  });

  it("la sessione chiusa riparte solo con un nuovo accesso (forza)", () => {
    const chiusa = voce({ stato: "sessione_chiusa" });
    expect(daInviare([chiusa], opts)).toEqual([]);
    expect(daInviare([chiusa], { ...opts, forza: true })).toEqual([chiusa]);
  });

  it("invia solo i punteggi di chi li ha inseriti", () => {
    const mio = voce();
    const suo = voce({ autoreId: "admin-2" });
    expect(daInviare([mio, suo], { ...opts, forza: true })).toEqual([mio]);
  });

  it("non reinvia salvati, conflitti e rifiutati; va in ordine di inserimento", () => {
    const prima = voce({ creataIl: "2027-06-12T09:00:00.000Z" });
    const dopo = voce({ creataIl: "2027-06-12T09:30:00.000Z" });
    const altri = (["salvato", "conflitto", "rifiutato"] as const).map(
      (stato) => voce({ stato }),
    );
    expect(daInviare([dopo, ...altri, prima], opts)).toEqual([prima, dopo]);
  });
});

describe("applicaEsito", () => {
  const ctx = { now: T0, random: () => 0 };

  it("salvato prende la versione del server", () => {
    const v = applicaEsito(
      voce({ stato: "invio" }),
      {
        status: "salvato",
        punteggio: { sets: [{ a: 21, b: 18 }], versione: 2 },
        duplicato: false,
      },
      ctx,
    );
    expect(v).toMatchObject({ stato: "salvato", versione: 2 });
  });

  it("rete o errore: resta in attesa e riprova più tardi", () => {
    const v = applicaEsito(voce({ stato: "invio" }), { status: "rete" }, ctx);
    expect(v.stato).toBe("in_attesa");
    expect(v.tentativi).toBe(1);
    expect(Date.parse(v.prossimoTentativo!)).toBe(T0.getTime() + 500);
  });

  it("sessione scaduta: il dato resta, salvato qui", () => {
    const v = applicaEsito(
      voce({ stato: "invio" }),
      { status: "sessionExpired" },
      ctx,
    );
    expect(v).toMatchObject({
      stato: "sessione_chiusa",
      sets: [{ a: 21, b: 18 }],
    });
  });

  it("conflitto: tiene il punteggio dell'altro admin per la scelta", () => {
    const server = { sets: [{ a: 21, b: 10 }], versione: 3 };
    const v = applicaEsito(
      voce({ stato: "invio" }),
      { status: "conflitto", punteggio: server },
      ctx,
    );
    expect(v).toMatchObject({ stato: "conflitto", server });
  });
});

describe("tieniIlMio", () => {
  it("riparte sulla versione mostrata con una chiave nuova", () => {
    const conflitto = voce({
      stato: "conflitto",
      server: { sets: [{ a: 21, b: 10 }], versione: 3 },
    });
    const v = tieniIlMio(conflitto, T0)!;
    expect(v).toMatchObject({ stato: "in_attesa", versione: 3 });
    expect(v.chiave).not.toBe(conflitto.chiave);
    expect(v.server).toBeUndefined();
  });
});

describe("seguitiDa", () => {
  it("un punteggio riscritto durante l'invio si appoggia al nostro salvataggio", () => {
    const salvata = voce({ stato: "salvato", versione: 2 });
    const seguito = voce({ versione: 1, sets: [{ a: 21, b: 15 }] });
    expect(seguitiDa([salvata, seguito], salvata, 1)).toEqual([
      { ...seguito, versione: 2 },
    ]);
  });
});

describe("riprendi e scaduti", () => {
  it("un invio interrotto torna in attesa", () => {
    expect(riprendi(voce({ stato: "invio" })).stato).toBe("in_attesa");
  });

  it("i salvati spariscono dopo un po'", () => {
    const vecchio = voce({ stato: "salvato" });
    const later = new Date(T0.getTime() + SALVATI_VISIBILI_MS + 1);
    expect(scaduti([vecchio], T0)).toEqual([]);
    expect(scaduti([vecchio], later)).toEqual([vecchio]);
  });
});

describe("testi", () => {
  it("riassume la coda a parole", () => {
    expect(
      riassuntoCoda([
        voce(),
        voce({ stato: "invio" }),
        voce({ stato: "sessione_chiusa" }),
      ]),
    ).toBe(
      "2 punteggi in attesa di invio, 1 punteggio salvato qui, non ancora inviato",
    );
    expect(riassuntoCoda([voce({ stato: "salvato" })])).toBeNull();
  });

  it("annuncia i cambi di stato, non il passaggio all'invio", () => {
    const attesa = voce();
    const invio = voce({ stato: "invio" });
    expect(annuncioCambio(undefined, attesa)).toBe(
      "Girone A · turno 1: in attesa di invio.",
    );
    expect(annuncioCambio(attesa, invio)).toBeNull();
    expect(annuncioCambio(invio, voce({ stato: "salvato" }))).toBe(
      "Girone A · turno 1: salvato.",
    );
    expect(annuncioCambio(invio, voce({ stato: "sessione_chiusa" }))).toMatch(
      /salvato qui, non ancora inviato/,
    );
    expect(annuncioCambio(invio, attesa)).toMatch(/in attesa di invio/);
    expect(annuncioCambio(voce({ stato: "invio", tentativi: 2 }), attesa)).toBe(
      null,
    );
  });
});
