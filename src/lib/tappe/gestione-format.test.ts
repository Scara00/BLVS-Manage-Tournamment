import { describe, expect, it } from "vitest";
import {
  faseTabellone,
  scadenzaDi,
  toGestioneTappaView,
  type TappaGestioneRow,
} from "./gestione-format";

const AT = new Date("2027-06-16T10:00:00Z");

function row(patch: Partial<TappaGestioneRow> = {}): TappaGestioneRow {
  return {
    id: "t1",
    nome: "Tappa 2 · Rimini",
    luogo: "Rimini, Bagno 26",
    data_inizio: "2027-06-26",
    data_fine: "2027-06-27",
    stato: "iscrizioni_aperte",
    iscrizioni_aprono_il: null,
    iscrizioni_chiudono_il: "2027-06-19T21:59:00Z",
    iscrizioni_chiuse_il: null,
    chiusura_automatica: false,
    ...patch,
  };
}

describe("toGestioneTappaView", () => {
  it("flusso con indici, testo e passo attuale", () => {
    const view = toGestioneTappaView(row(), [], AT);
    expect(view.flusso).toEqual([
      { stato: "bozza", indice: 1, label: "Bozza", posizione: "fatto" },
      {
        stato: "iscrizioni_aperte",
        indice: 2,
        label: "Iscrizioni aperte",
        posizione: "attuale",
      },
      {
        stato: "iscrizioni_chiuse",
        indice: 3,
        label: "Iscrizioni chiuse",
        posizione: "futuro",
      },
    ]);
    expect(view.periodo).toBe("26–27 giugno");
  });

  it("dopo il flusso tutti i passi sono fatti, con una nota", () => {
    const view = toGestioneTappaView(row({ stato: "in_corso" }), [], AT);
    expect(view.flusso.map((p) => p.posizione)).toEqual([
      "fatto",
      "fatto",
      "fatto",
    ]);
    expect(view.notaStato).toMatch(/in corso/);
    expect(view.transizione).toBeNull();
    expect(view.scadenzaModificabile).toBe(false);
  });

  it("la tappa aperta propone la chiusura con il confronto", () => {
    const { transizione } = toGestioneTappaView(row(), [], AT);
    expect(transizione).toMatchObject({
      da: "iscrizioni_aperte",
      a: "iscrizioni_chiuse",
      tipo: "chiusura",
      azione: "Chiudi le iscrizioni",
      bloccata: null,
    });
    expect(transizione?.confronto).toHaveLength(4);
  });

  it("una bozza senza scadenza non si può aprire, e dice perché", () => {
    const { transizione, scadenza } = toGestioneTappaView(
      row({ stato: "bozza", iscrizioni_chiudono_il: null }),
      [],
      AT,
    );
    expect(transizione?.effetto).toMatch(
      /La tappa diventerà visibile ai giocatori/,
    );
    expect(transizione?.bloccata).toMatch(/Imposta prima la scadenza/);
    expect(scadenza.titolo).toBe("Scadenza non impostata");
  });

  it("tabelloni M poi F, con iscritti e fase", () => {
    const view = toGestioneTappaView(
      row(),
      [
        { categoria: "F", confermate: 2, inAttesa: 1, fasiPartite: [] },
        { categoria: "M", confermate: 5, inAttesa: 0, fasiPartite: [] },
      ],
      AT,
    );
    expect(view.tabelloni).toEqual([
      {
        categoria: "M",
        categoriaLabel: "Maschile",
        iscritti: 5,
        inAttesa: 0,
        fase: "Raccolta iscrizioni",
        concluso: false,
      },
      {
        categoria: "F",
        categoriaLabel: "Femminile",
        iscritti: 2,
        inAttesa: 1,
        fase: "Raccolta iscrizioni",
        concluso: false,
      },
    ]);
  });
});

describe("scadenzaDi", () => {
  it("giorni alla chiusura e chiusura automatica a testo", () => {
    expect(scadenzaDi(row(), AT)).toEqual({
      titolo: "Chiusura tra 3 giorni",
      dettaglio:
        "Il 19 giugno 2027 alle 23:59 le iscrizioni si chiudono automaticamente.",
      giorni: 3,
      automatica: true,
    });
  });

  it("oggi e domani con l'ora", () => {
    expect(scadenzaDi(row(), new Date("2027-06-19T08:00:00Z")).titolo).toBe(
      "Chiusura oggi alle 23:59",
    );
    expect(scadenzaDi(row(), new Date("2027-06-18T08:00:00Z")).titolo).toBe(
      "Chiusura domani alle 23:59",
    );
  });

  it("dice se le iscrizioni le ha chiuse il sistema alla scadenza", () => {
    const scadenza = scadenzaDi(
      row({
        stato: "iscrizioni_chiuse",
        chiusura_automatica: true,
        iscrizioni_chiuse_il: "2027-06-19T22:00:00Z",
      }),
      AT,
    );
    expect(scadenza.titolo).toBe(
      "Iscrizioni chiuse automaticamente alla scadenza",
    );
    expect(scadenza.dettaglio).toBe(
      "Il sistema le ha chiuse il 20 giugno 2027 alle 00:00.",
    );
  });

  it("chiusa a mano", () => {
    expect(
      scadenzaDi(
        row({
          stato: "iscrizioni_chiuse",
          iscrizioni_chiuse_il: "2027-06-17T08:00:00Z",
        }),
        AT,
      ).titolo,
    ).toBe("Iscrizioni chiuse a mano");
  });
});

describe("faseTabellone", () => {
  it("la fase più avanzata delle partite vince", () => {
    expect(faseTabellone("in_corso", ["gironi", "eliminazione"])).toBe(
      "Eliminazione diretta",
    );
    expect(faseTabellone("in_corso", [])).toBe("In attesa delle partite");
    expect(faseTabellone("conclusa", ["finale"])).toBe("Concluso");
    expect(faseTabellone("bozza", [])).toBe("In preparazione");
  });
});
