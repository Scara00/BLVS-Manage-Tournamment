import { describe, expect, it } from "vitest";
import {
  CATEGORY_REQUIRED_MESSAGE,
  CONSENT_REQUIRED_MESSAGE,
  readSignup,
  type SignupInput,
} from "./signup";

const valid: SignupInput = {
  nome: " Giulia ",
  cognome: "Colombo",
  email: " Giulia.Colombo@Example.IT ",
  password: "una-password-lunga",
  categoria: "F",
  consensoPrivacy: true,
};

describe("readSignup", () => {
  it("accetta un modulo completo e normalizza l'email", () => {
    expect(readSignup(valid)).toEqual({
      ok: true,
      values: {
        nome: "Giulia",
        cognome: "Colombo",
        email: "giulia.colombo@example.it",
        password: "una-password-lunga",
        categoria: "F",
      },
    });
  });

  it("segnala ogni campo vuoto con il suo messaggio", () => {
    const result = readSignup({
      nome: "  ",
      cognome: "",
      email: "",
      password: "",
      categoria: "",
      consensoPrivacy: false,
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        nome: "Campo obbligatorio.",
        cognome: "Campo obbligatorio.",
        email: "Campo obbligatorio.",
        password: "Campo obbligatorio.",
        categoria: CATEGORY_REQUIRED_MESSAGE,
        consensoPrivacy: CONSENT_REQUIRED_MESSAGE,
      },
    });
  });

  it("controlla formato email, lunghezza password e categoria", () => {
    const result = readSignup({
      ...valid,
      email: "giulia@",
      password: "corta",
      categoria: "X",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual({
      email: "Inserisci un'email valida, es. nome@esempio.it.",
      password: "Almeno 10 caratteri.",
      categoria: "Valore non ammesso.",
    });
  });

  it("rifiuta password oltre i 72 caratteri (limite bcrypt)", () => {
    const result = readSignup({ ...valid, password: "x".repeat(73) });
    expect(result).toMatchObject({
      ok: false,
      errors: { password: "Massimo 72 caratteri." },
    });
  });

  it("il consenso è obbligatorio e deve essere esplicito (true)", () => {
    for (const consensoPrivacy of [false, "true", 1, undefined]) {
      const result = readSignup({ ...valid, consensoPrivacy });
      expect(result).toEqual({
        ok: false,
        errors: { consensoPrivacy: CONSENT_REQUIRED_MESSAGE },
      });
    }
  });

  it("limita nome e cognome a 100 caratteri", () => {
    const result = readSignup({ ...valid, cognome: "a".repeat(101) });
    expect(result).toMatchObject({
      ok: false,
      errors: { cognome: "Massimo 100 caratteri." },
    });
  });
});
