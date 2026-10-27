import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NUOVA_TAPPA_MESSAGES as M } from "./types";
import { validaNuovaTappa } from "./validation";

// 27 ottobre 2027, 10:00 a Roma (CEST).
const ADESSO = new Date("2027-10-27T08:00:00Z");

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  const defaults = {
    nome: "Tappa 4 · Lignano",
    luogo: "Lignano, Bagno 3",
    data: "2027-11-14",
    scadenza: "2027-11-07T23:59",
    postiM: "16",
    postiF: "32",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(ADESSO);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("validaNuovaTappa", () => {
  it("accetta una tappa valida e converte la scadenza da Roma", () => {
    expect(validaNuovaTappa(form())).toEqual({
      ok: true,
      values: {
        nome: "Tappa 4 · Lignano",
        luogo: "Lignano, Bagno 3",
        data: "2027-11-14",
        // 7 novembre è ora solare: +1.
        scadenza: "2027-11-07T22:59:00.000Z",
        postiM: 16,
        postiF: 32,
      },
    });
  });

  it("segnala tutti i campi obbligatori", () => {
    const result = validaNuovaTappa(
      form({
        nome: "",
        luogo: " ",
        data: "",
        scadenza: "",
        postiM: "",
        postiF: "",
      }),
    );
    expect(result).toEqual({
      ok: false,
      fields: {
        nome: "Campo obbligatorio.",
        luogo: "Campo obbligatorio.",
        data: "Campo obbligatorio.",
        scadenza: "Campo obbligatorio.",
        postiM: "Campo obbligatorio.",
        postiF: "Campo obbligatorio.",
      },
    });
  });

  it.each(["2027-10-27", "2027-10-01"])("la data %s non è futura", (data) => {
    expect(
      validaNuovaTappa(form({ data, scadenza: "2027-10-26T10:00" })),
    ).toMatchObject({ ok: false, fields: { data: M.dataPassata } });
  });

  it("domani è una data valida", () => {
    expect(
      validaNuovaTappa(
        form({ data: "2027-10-28", scadenza: "2027-10-27T20:00" }),
      ),
    ).toMatchObject({ ok: true });
  });

  it("rifiuta una data inesistente", () => {
    expect(validaNuovaTappa(form({ data: "2027-02-30" }))).toMatchObject({
      ok: false,
      fields: { data: M.dataNonValida },
    });
  });

  it("la scadenza deve precedere la mezzanotte del giorno della tappa", () => {
    expect(
      validaNuovaTappa(form({ scadenza: "2027-11-14T00:00" })),
    ).toMatchObject({ ok: false, fields: { scadenza: M.scadenzaDopoTappa } });
    expect(
      validaNuovaTappa(form({ scadenza: "2027-11-20T10:00" })),
    ).toMatchObject({ ok: false, fields: { scadenza: M.scadenzaDopoTappa } });
    expect(
      validaNuovaTappa(form({ scadenza: "2027-11-13T23:59" })),
    ).toMatchObject({ ok: true });
  });

  it("la scadenza deve essere futura", () => {
    expect(
      validaNuovaTappa(form({ scadenza: "2027-10-27T09:59" })),
    ).toMatchObject({ ok: false, fields: { scadenza: M.scadenzaPassata } });
  });

  it("segnala l'ora saltata dal cambio d'ora", () => {
    expect(
      validaNuovaTappa(
        form({ data: "2028-04-02", scadenza: "2028-03-26T02:30" }),
      ),
    ).toMatchObject({ ok: false, fields: { scadenza: M.oraInesistente } });
  });

  it.each(["3", "257", "16.5", "abc", "-8"])(
    "rifiuta %s come massimo iscritti",
    (posti) => {
      expect(validaNuovaTappa(form({ postiF: posti }))).toMatchObject({
        ok: false,
        fields: { postiF: M.posti },
      });
    },
  );

  it("un massimo con gironi incompleti non è un errore", () => {
    expect(validaNuovaTappa(form({ postiM: "20" }))).toMatchObject({
      ok: true,
      values: { postiM: 20 },
    });
  });
});
