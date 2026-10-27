import { describe, expect, it } from "vitest";
import type { TappaModifica } from "./types";
import { errorePosti, validaTappaModifica } from "./validation";

const ADESSO = new Date("2027-05-01T10:00:00Z");

const tappa: TappaModifica = {
  id: "t1",
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data: "2027-06-28",
  dataFine: "2027-06-29",
  scadenza: "2027-06-24T20:00",
  stato: "iscrizioni_aperte",
  versione: 3,
  tabelloni: {
    M: { posti: 16, iscritti: 12 },
    F: { posti: 16, iscritti: 9 },
  },
};

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    nome: tappa.nome,
    luogo: tappa.luogo,
    data: tappa.data,
    scadenza: tappa.scadenza,
    postiM: "16",
    postiF: "16",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("validaTappaModifica: massimo e iscritti", () => {
  it("blocca un massimo sotto il numero degli iscritti", () => {
    expect(validaTappaModifica(form({ postiM: "11" }), tappa, ADESSO)).toEqual({
      ok: false,
      fields: { postiM: "Il massimo non può scendere sotto 12" },
    });
  });

  it("controlla ogni tabellone con i suoi iscritti", () => {
    const result = validaTappaModifica(
      form({ postiM: "4", postiF: "8" }),
      tappa,
      ADESSO,
    );
    expect(result).toEqual({
      ok: false,
      fields: {
        postiM: "Il massimo non può scendere sotto 12",
        postiF: "Il massimo non può scendere sotto 9",
      },
    });
  });

  it("un massimo pari agli iscritti è valido", () => {
    const result = validaTappaModifica(form({ postiM: "12" }), tappa, ADESSO);
    expect(result).toMatchObject({
      ok: true,
      values: { postiM: 12, postiF: 16 },
    });
  });

  it("senza iscritti valgono i limiti generali", () => {
    expect(errorePosti("2", 0)).toBe("Inserisci un numero intero tra 4 e 256.");
    expect(errorePosti("300", 0)).toBe(
      "Inserisci un numero intero tra 4 e 256.",
    );
    expect(errorePosti("4", 0)).toBeUndefined();
    expect(errorePosti("", 0)).toBe("Campo obbligatorio.");
    expect(errorePosti("12.5", 0)).toBe(
      "Inserisci un numero intero tra 4 e 256.",
    );
  });
});

describe("validaTappaModifica: date", () => {
  it("restituisce i valori puliti, con la scadenza in ora italiana", () => {
    expect(validaTappaModifica(form(), tappa, ADESSO)).toEqual({
      ok: true,
      values: {
        nome: tappa.nome,
        luogo: tappa.luogo,
        data: "2027-06-28",
        scadenza: "2027-06-24T18:00:00.000Z",
        postiM: 16,
        postiF: 16,
      },
    });
  });

  it("una data già passata resta valida finché non la si cambia", () => {
    const passata = {
      ...tappa,
      data: "2027-04-01",
      scadenza: "2027-03-20T20:00",
    };
    expect(
      validaTappaModifica(
        form({ data: "2027-04-01", scadenza: "2027-03-20T20:00" }),
        passata,
        ADESSO,
      ),
    ).toMatchObject({ ok: true });
  });

  it("una nuova data deve essere futura", () => {
    expect(
      validaTappaModifica(form({ data: "2027-04-30" }), tappa, ADESSO),
    ).toMatchObject({
      ok: false,
      fields: { data: "La data della tappa deve essere futura." },
    });
  });

  it("la scadenza deve precedere il primo giorno", () => {
    expect(
      validaTappaModifica(
        form({ scadenza: "2027-06-28T09:00" }),
        tappa,
        ADESSO,
      ),
    ).toMatchObject({
      ok: false,
      fields: { scadenza: "La scadenza deve precedere la data della tappa." },
    });
  });

  it("campi obbligatori vuoti", () => {
    expect(
      validaTappaModifica(form({ nome: " ", luogo: "" }), tappa, ADESSO),
    ).toMatchObject({
      ok: false,
      fields: { nome: "Campo obbligatorio.", luogo: "Campo obbligatorio." },
    });
  });
});
