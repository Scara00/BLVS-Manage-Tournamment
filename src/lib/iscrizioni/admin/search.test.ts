import { describe, expect, it } from "vitest";
import { filtriRicerca, paroleRicerca } from "./search";

describe("paroleRicerca", () => {
  it("non cerca sotto i 2 caratteri", () => {
    expect(paroleRicerca("")).toEqual([]);
    expect(paroleRicerca("  a ")).toEqual([]);
  });

  it("divide in parole, al massimo 4", () => {
    expect(paroleRicerca("  rossi   luca ")).toEqual(["rossi", "luca"]);
    expect(paroleRicerca("a b c d e f")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("filtriRicerca", () => {
  it("una condizione or per parola, su nome, cognome ed email", () => {
    expect(filtriRicerca(["rossi"])).toEqual([
      'nome.ilike."%rossi%",cognome.ilike."%rossi%",email.ilike."%rossi%"',
    ]);
  });

  it("caratteri speciali di LIKE e di PostgREST non cambiano la ricerca", () => {
    const [filtro] = filtriRicerca(['50%_a,b("x")']);
    expect(filtro).toContain('nome.ilike."%50\\\\%\\\\_a,b(\\"x\\")%"');
  });
});
