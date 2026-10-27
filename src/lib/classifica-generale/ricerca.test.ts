import { describe, expect, it } from "vitest";
import {
  filtraPerNome,
  normalizzaNome,
  risultatiRicercaLabel,
} from "./ricerca";

const righe = [
  { nome: "Luca Rossi" },
  { nome: "Niccolò Bianchi" },
  { nome: "Lorenzo Bruno-Gallo de Santis" },
];
const nome = (r: { nome: string }) => r.nome;

describe("ricerca per nome", () => {
  it("ignora maiuscole, accenti e spazi", () => {
    expect(normalizzaNome("  NICCOLÒ   Bianchi ")).toBe("niccolo bianchi");
    expect(filtraPerNome(righe, "niccolo", nome)).toEqual([righe[1]]);
  });

  it("ogni parola deve comparire nel nome, in qualunque ordine", () => {
    expect(filtraPerNome(righe, "santis lorenzo", nome)).toEqual([righe[2]]);
    expect(filtraPerNome(righe, "rossi bianchi", nome)).toEqual([]);
  });

  it("senza testo restano tutte le righe, nello stesso ordine", () => {
    expect(filtraPerNome(righe, "  ", nome)).toEqual(righe);
  });

  it("dice quanti giocatori ha trovato", () => {
    expect(risultatiRicercaLabel(3, "")).toBe("");
    expect(risultatiRicercaLabel(1, "luca")).toBe("1 giocatore trovato.");
    expect(risultatiRicercaLabel(2, "lu")).toBe("2 giocatori trovati.");
    expect(risultatiRicercaLabel(0, " zz ")).toBe(
      "Nessun giocatore trovato per «zz».",
    );
  });
});
