import { describe, expect, it } from "vitest";
import { csvField, csvFilename, iscrittiCsv } from "./csv";
import { toIscrittiTappaView } from "./format";
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

const tappa = toIscrittiTappaView(
  {
    id: "rimini",
    nome: "Tappa 2 · Rimini",
    data_inizio: "2027-06-26",
    data_fine: "2027-06-27",
    stato: "iscrizioni_aperte",
  },
  [
    { categoria: "M", posti: 16 },
    { categoria: "F", posti: 16 },
  ],
  [
    row({
      posto: 2,
      nome: "Nicolò",
      cognome: "D'Amico",
      email: "n@example.it",
    }),
    row({ posto: 1 }),
    row({
      posto: 1,
      categoria: "F",
      nome: "Chiara",
      cognome: 'Rossi; "la Bomber"',
      email: "c@example.it",
      stato: "in_attesa",
      created_at: "2027-05-13T07:05:00Z",
    }),
  ],
);

describe("iscrittiCsv", () => {
  const csv = iscrittiCsv(tappa);

  it("inizia con il BOM UTF-8 e usa CRLF", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toHaveLength(5);
  });

  it("ha intestazione e una riga per iscritto, per tabellone e posto", () => {
    expect(csv.slice(1).split("\r\n").slice(0, 4)).toEqual([
      "Categoria;Posto;Cognome e nome;Email;Stato;Iscritto il",
      "Maschile;1;Rossi Luca;luca.rossi@example.it;Confermata;12/05/2027 14:30",
      "Maschile;2;D'Amico Nicolò;n@example.it;Confermata;12/05/2027 14:30",
      'Femminile;1;"Rossi; ""la Bomber"" Chiara";c@example.it;In attesa;13/05/2027 09:05',
    ]);
  });

  it("i nomi accentati sono byte UTF-8", () => {
    const bytes = new TextEncoder().encode(csv);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder("utf-8").decode(bytes)).toContain("Nicolò");
  });

  it("senza iscritti resta l'intestazione", () => {
    const vuota = iscrittiCsv({ ...tappa, tabelloni: [] });
    expect(vuota).toBe(
      "﻿Categoria;Posto;Cognome e nome;Email;Stato;Iscritto il\r\n",
    );
  });
});

describe("csvField", () => {
  it("mette tra virgolette separatore, virgolette e a capo", () => {
    expect(csvField("a;b")).toBe('"a;b"');
    expect(csvField('a"b')).toBe('"a""b"');
    expect(csvField("a\nb")).toBe('"a\nb"');
    expect(csvField("semplice")).toBe("semplice");
  });

  it("neutralizza le formule", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+39 333")).toBe("'+39 333");
    expect(csvField("-1")).toBe("'-1");
    expect(csvField("@cmd")).toBe("'@cmd");
  });
});

describe("csvFilename", () => {
  it("è ASCII e leggibile", () => {
    expect(csvFilename({ nome: "Tappa 2 · Rimini" })).toBe(
      "iscritti-tappa-2-rimini.csv",
    );
    expect(csvFilename({ nome: "Città è più" })).toBe(
      "iscritti-citta-e-piu.csv",
    );
    expect(csvFilename({ nome: "···" })).toBe("iscritti-tappa.csv");
  });
});
