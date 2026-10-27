import { describe, expect, it } from "vitest";
import { versioneDaConflitto } from "./errori";
import {
  confrontaPunteggi,
  descriviDifferenze,
  formatSets,
  introConflitto,
  leggiSets,
  puoSalvare,
  rilevaConflitto,
  stessiSets,
} from "./rileva";

const coppie = { a: "Rossi/Bianchi", b: "Verdi/Neri" };

describe("rilevamento del conflitto", () => {
  it("c'è conflitto solo se la versione è cambiata", () => {
    expect(rilevaConflitto(3, 3)).toBe(false);
    expect(rilevaConflitto(3, 4)).toBe(true);
    expect(rilevaConflitto(4, 3)).toBe(true);
  });

  it("un salvataggio con la versione letta passa", () => {
    expect(puoSalvare({ versione: 2 }, 2)).toBe(true);
  });

  it("nessuna sovrascrittura silenziosa: una versione superata non passa mai", () => {
    expect(puoSalvare({ versione: 2 }, 3)).toBe(false);
    expect(puoSalvare({ versione: 2, sovrascrivi: null }, 3)).toBe(false);
  });

  it("«Sovrascrivi» vale solo sul valore mostrato nel dialog", () => {
    // The dialog showed version 3: overwriting it is allowed.
    expect(puoSalvare({ versione: 2, sovrascrivi: 3 }, 3)).toBe(true);
    // A third admin saved version 4 meanwhile: the dialog opens again.
    expect(puoSalvare({ versione: 2, sovrascrivi: 3 }, 4)).toBe(false);
  });

  it("confronta i sets", () => {
    expect(stessiSets([{ a: 21, b: 18 }], [{ a: 21, b: 18 }])).toBe(true);
    expect(stessiSets([{ a: 21, b: 18 }], [{ a: 21, b: 19 }])).toBe(false);
    expect(stessiSets([], [{ a: 21, b: 19 }])).toBe(false);
  });
});

describe("confrontaPunteggi", () => {
  it("segna solo le cifre diverse", () => {
    const [set] = confrontaPunteggi([{ a: 21, b: 18 }], [{ a: 21, b: 19 }]);
    expect(set.salvato?.a).toEqual({ valore: 21, diverso: false });
    expect(set.salvato?.b).toEqual({ valore: 18, diverso: true });
    expect(set.mio?.b).toEqual({ valore: 19, diverso: true });
  });

  it("un set presente da una sola parte è tutto diverso", () => {
    const confronto = confrontaPunteggi(
      [
        { a: 21, b: 18 },
        { a: 19, b: 21 },
      ],
      [{ a: 21, b: 18 }],
    );
    expect(confronto).toHaveLength(2);
    expect(confronto[1].mio).toBeNull();
    expect(confronto[1].salvato?.a.diverso).toBe(true);
    expect(confronto[1].salvato?.b.diverso).toBe(true);
  });

  it("descrive le differenze a parole", () => {
    const confronto = confrontaPunteggi(
      [
        { a: 21, b: 18 },
        { a: 15, b: 13 },
      ],
      [{ a: 21, b: 19 }],
    );
    expect(descriviDifferenze(confronto, coppie)).toEqual([
      "Set 1, Verdi/Neri: salvato 18, tuo 19",
      "Set 2: salvato 15-13, tuo nessuno",
    ]);
  });

  it("nessuna differenza, nessuna riga", () => {
    const confronto = confrontaPunteggi([{ a: 21, b: 18 }], [{ a: 21, b: 18 }]);
    expect(descriviDifferenze(confronto, coppie)).toEqual([]);
  });
});

describe("formati", () => {
  it("formatta e legge i sets", () => {
    expect(
      formatSets([
        { a: 21, b: 18 },
        { a: 19, b: 21 },
      ]),
    ).toBe("21-18 · 19-21");
    expect(formatSets([])).toBe("nessun punteggio");
    expect(leggiSets([{ a: 21, b: 18 }])).toBe("set 1: 21 a 18");
  });

  it("introduce il conflitto con autore e ora di Roma", () => {
    expect(
      introConflitto({
        versione: 3,
        sets: [],
        autore: "Giulia Neri",
        salvatoIl: "2026-06-12T12:05:00Z",
      }),
    ).toBe(
      "Un altro admin (Giulia Neri) ha salvato questa partita alle 14:05 mentre la modificavi.",
    );
    expect(
      introConflitto({ versione: 3, sets: [], autore: null, salvatoIl: null }),
    ).toBe("Un altro admin ha salvato questa partita mentre la modificavi.");
  });
});

describe("versioneDaConflitto", () => {
  it("legge la versione attuale dal detail", () => {
    expect(
      versioneDaConflitto({
        code: "40001",
        hint: "punteggio_cambiato",
        detail: "4",
      }),
    ).toBe(4);
    expect(
      versioneDaConflitto({ code: "40001", detail: '{"versione":5}' }),
    ).toBe(5);
    expect(versioneDaConflitto({ code: "40001", detail: "boh" })).toBeNull();
  });

  it("ignora gli altri errori", () => {
    expect(versioneDaConflitto({ code: "42501" })).toBeUndefined();
    expect(versioneDaConflitto({ code: "23514", hint: "set" })).toBeUndefined();
  });
});
