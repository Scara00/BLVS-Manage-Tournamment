import { describe, expect, it } from "vitest";
import { spiegaRegolaSet } from "./regola";
import {
  codiceErrore,
  leggiPunti,
  MESSAGGI_VALIDAZIONE,
  messaggioRegolaSet,
  validaPunteggio,
} from "./validazione";

describe("codiceErrore (regola del set)", () => {
  it.each([
    [21, 19],
    [21, 0],
    [19, 21],
    [22, 20],
    [30, 28],
    [28, 30],
  ])("%i–%i è valido", (a, b) => {
    expect(codiceErrore(a, b)).toBeNull();
  });

  it.each([
    [21, 20, "regola_set"],
    [20, 18, "regola_set"],
    [23, 20, "regola_set"],
    [25, 10, "regola_set"],
    [21, 21, "pareggio"],
    [0, 0, "pareggio"],
    [-1, 21, "valori_non_validi"],
    [21.5, 19, "valori_non_validi"],
    [100, 98, "valori_non_validi"],
  ])("%s–%s → %s", (a, b, codice) => {
    expect(codiceErrore(a, b)).toBe(codice);
  });
});

describe("leggiPunti", () => {
  it("accetta solo interi non negativi", () => {
    expect(leggiPunti("")).toBeNull();
    expect(leggiPunti("  ")).toBeNull();
    expect(leggiPunti("21")).toBe(21);
    expect(leggiPunti(" 7 ")).toBe(7);
    for (const raw of ["-1", "1.5", "1,5", "+3", "2e1", "abc", "100"]) {
      expect(leggiPunti(raw)).toBeNaN();
    }
  });
});

describe("validaPunteggio", () => {
  it("un punteggio valido ha ✓ su entrambi i campi e un vincitore", () => {
    const v = validaPunteggio({ a: "19", b: "21" });
    expect(v).toMatchObject({
      valido: true,
      vincitore: "b",
      esiti: { a: "valido", b: "valido" },
      campi: {},
      punteggio: null,
    });
  });

  it("mentre si scrive un campo vuoto è «da inserire», non un errore", () => {
    const v = validaPunteggio({ a: "21", b: "" }, { completo: false });
    expect(v.valido).toBe(false);
    expect(v.campi).toEqual({});
    expect(v.esiti).toEqual({ a: "vuoto", b: "vuoto" });
  });

  it("al riepilogo un campo vuoto è un errore del campo", () => {
    const v = validaPunteggio({ a: "21", b: "" });
    expect(v.campi).toEqual({ b: MESSAGGI_VALIDAZIONE.mancante });
    expect(v.esiti.b).toBe("errore");
    expect(v.codice).toBe("mancante");
  });

  it("un valore non intero è un errore del campo", () => {
    const v = validaPunteggio({ a: "1.5", b: "21" });
    expect(v.campi).toEqual({ a: MESSAGGI_VALIDAZIONE.nonValido });
    expect(v.codice).toBe("valori_non_validi");
  });

  it("il pareggio è un errore del punteggio, su entrambi i campi", () => {
    const v = validaPunteggio({ a: "21", b: "21" });
    expect(v.punteggio).toBe(MESSAGGI_VALIDAZIONE.pareggio);
    expect(v.esiti).toEqual({ a: "errore", b: "errore" });
    expect(v.valido).toBe(false);
  });

  it("la regola del set spiega cosa correggere", () => {
    expect(validaPunteggio({ a: "21", b: "20" }).punteggio).toBe(
      messaggioRegolaSet(21, 20),
    );
    expect(messaggioRegolaSet(18, 15)).toContain("almeno a 21");
    expect(messaggioRegolaSet(21, 20)).toContain("22–20");
    expect(messaggioRegolaSet(25, 20)).toContain("25–23");
  });

  it("la regola è descritta con i suoi numeri", () => {
    expect(spiegaRegolaSet()).toMatch(/21.*2 punti di scarto/);
  });
});
