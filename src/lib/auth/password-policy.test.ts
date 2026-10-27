import { describe, expect, it } from "vitest";
import { checkPassword, newPasswordErrors } from "./password-policy";

describe("requisiti della password", () => {
  it("dà l'esito di ogni requisito, coincidenza compresa", () => {
    expect(checkPassword("abc", "abd")).toEqual([
      { id: "lunghezza", label: "Da 10 a 72 caratteri", met: false },
      { id: "lettera", label: "Almeno una lettera", met: true },
      { id: "cifra", label: "Almeno un numero", met: false },
      { id: "coincidono", label: "Le due password coincidono", met: false },
    ]);
    expect(
      checkPassword("Spiaggia-2026", "Spiaggia-2026").every((r) => r.met),
    ).toBe(true);
  });

  it("senza conferma non mostra la coincidenza", () => {
    expect(checkPassword("x").map((r) => r.id)).toEqual([
      "lunghezza",
      "lettera",
      "cifra",
    ]);
  });

  it("due campi vuoti non coincidono", () => {
    expect(checkPassword("", "").at(-1)?.met).toBe(false);
  });

  it("accetta da 10 a 72 caratteri", () => {
    expect(checkPassword(`a1${"x".repeat(7)}`)[0].met).toBe(false);
    expect(checkPassword(`a1${"x".repeat(8)}`)[0].met).toBe(true);
    expect(checkPassword(`a1${"x".repeat(70)}`)[0].met).toBe(true);
    expect(checkPassword(`a1${"x".repeat(71)}`)[0].met).toBe(false);
  });

  it("errori per campo, in italiano", () => {
    expect(newPasswordErrors("", "")).toEqual({
      password: "Inserisci la nuova password.",
      conferma: "Ripeti la nuova password.",
    });
    expect(newPasswordErrors("1234567890", "1234567890")).toEqual({
      password: "La password non rispetta i requisiti: almeno una lettera.",
    });
    expect(newPasswordErrors("Spiaggia-2026", "Spiaggia-2025")).toEqual({
      conferma: "Le due password non coincidono.",
    });
    expect(newPasswordErrors("Spiaggia-2026", "Spiaggia-2026")).toEqual({});
  });
});
