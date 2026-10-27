import { describe, expect, it } from "vitest";
import {
  formatIscrittoIl,
  iscrittiModificabili,
  postiLiberiTesto,
  risultatiTesto,
  toIscrittiTappaView,
} from "./format";
import type { IscrittoRow } from "./types";

function row(over: Partial<IscrittoRow>): IscrittoRow {
  return {
    id: crypto.randomUUID(),
    posto: 1,
    stato: "confermata",
    created_at: "2027-05-12T12:30:00Z",
    categoria: "M",
    nome: "Luca",
    cognome: "Rossi",
    email: "luca.rossi@example.it",
    ...over,
  };
}

const tappa = {
  id: "rimini",
  nome: "Tappa 2 · Rimini",
  data_inizio: "2027-06-26",
  data_fine: "2027-06-27",
  stato: "iscrizioni_chiuse" as const,
};

describe("postiLiberiTesto", () => {
  it.each([
    [16, 11, "5 POSTI LIBERI"],
    [16, 15, "1 POSTO LIBERO"],
    [16, 16, "NESSUN POSTO LIBERO"],
    [16, 17, "1 OLTRE IL MASSIMO"],
    [16, 19, "3 OLTRE IL MASSIMO"],
  ])("%i posti, %i occupati → %s", (posti, occupati, testo) => {
    expect(postiLiberiTesto(posti, occupati)).toBe(testo);
  });
});

describe("formatIscrittoIl", () => {
  it("scrive data e ora di Roma in cifre", () => {
    expect(formatIscrittoIl("2027-05-12T12:30:00Z")).toBe("12/05/2027 14:30");
    expect(formatIscrittoIl("2027-01-03T08:05:00Z")).toBe("03/01/2027 09:05");
  });
});

describe("toIscrittiTappaView", () => {
  it("divide per tabellone (M prima di F), ordina per posto e conta i liberi", () => {
    const view = toIscrittiTappaView(
      tappa,
      [
        { categoria: "F", posti: 4 },
        { categoria: "M", posti: 4 },
      ],
      [
        row({ posto: 3, nome: "Marco", cognome: "Bianchi" }),
        row({ posto: 1 }),
        row({ posto: 2, categoria: "F", nome: "Giulia", stato: "in_attesa" }),
        row({ posto: 2, stato: "ritirata" }),
      ],
    );
    expect(view.tabelloni.map((t) => t.categoria)).toEqual(["M", "F"]);
    const [m, f] = view.tabelloni;
    expect(m.iscritti.map((i) => [i.posto, i.nome])).toEqual([
      [1, "Rossi Luca"],
      [3, "Bianchi Marco"],
    ]);
    expect(m.liberiTesto).toBe("2 POSTI LIBERI");
    expect(f.iscritti[0]).toMatchObject({
      statoLabel: "In attesa",
      iscrittoIlTesto: "12/05/2027 14:30",
    });
    expect(view).toMatchObject({ modificabile: true, notaSolaLettura: null });
  });

  it("un tabellone pieno lo dice", () => {
    const view = toIscrittiTappaView(
      tappa,
      [{ categoria: "M", posti: 1 }],
      [row({})],
    );
    expect(view.tabelloni[0]).toMatchObject({
      pieno: true,
      liberi: 0,
      liberiTesto: "NESSUN POSTO LIBERO",
    });
  });

  it.each(["in_corso", "conclusa", "annullata", "archiviata"] as const)(
    "una tappa %s è in sola lettura, con il motivo",
    (stato) => {
      const view = toIscrittiTappaView({ ...tappa, stato }, [], []);
      expect(view.modificabile).toBe(false);
      expect(view.notaSolaLettura).toEqual(expect.any(String));
      expect(iscrittiModificabili(stato)).toBe(false);
    },
  );
});

describe("risultatiTesto", () => {
  it("annuncia quanti giocatori ha trovato", () => {
    expect(risultatiTesto(0)).toBe("Nessun giocatore trovato.");
    expect(risultatiTesto(1)).toBe("1 giocatore trovato.");
    expect(risultatiTesto(7)).toBe("7 giocatori trovati.");
  });
});
