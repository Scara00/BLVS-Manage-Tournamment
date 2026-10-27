import { describe, expect, it } from "vitest";
import { STATI_TAPPA, type StatoTappa } from "@/lib/db/types";
import {
  contaPerStato,
  contaPosti,
  descriviPosti,
  filtraPerStato,
  isGiornoDiGara,
  parseFiltroStato,
  partiteDaInserireLabel,
  partiteDaInserireOggi,
  toAdminTappa,
  type AdminTappaRpcRow,
} from "./tappe";

const tappe: { id: string; stato: StatoTappa }[] = [
  { id: "a", stato: "bozza" },
  { id: "b", stato: "iscrizioni_aperte" },
  { id: "c", stato: "iscrizioni_aperte" },
  { id: "d", stato: "in_corso" },
  { id: "e", stato: "conclusa" },
];

describe("filtro per stato", () => {
  it("«tutte» restituisce ogni tappa, bozze comprese, nello stesso ordine", () => {
    expect(filtraPerStato(tappe, "tutte").map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it.each(STATI_TAPPA)("lo stato %s mostra solo le sue tappe", (stato) => {
    const result = filtraPerStato(tappe, stato);
    expect(result.every((t) => t.stato === stato)).toBe(true);
    expect(result).toHaveLength(tappe.filter((t) => t.stato === stato).length);
  });

  it("non modifica l'elenco di partenza", () => {
    const copy = [...tappe];
    filtraPerStato(tappe, "bozza");
    expect(tappe).toEqual(copy);
  });

  it("legge ?stato= e ripiega su «tutte» per valori sconosciuti", () => {
    expect(parseFiltroStato("bozza")).toBe("bozza");
    expect(parseFiltroStato(["in_corso", "bozza"])).toBe("in_corso");
    expect(parseFiltroStato("pubblicata")).toBe("tutte");
    expect(parseFiltroStato("")).toBe("tutte");
    expect(parseFiltroStato(undefined)).toBe("tutte");
    expect(parseFiltroStato(null)).toBe("tutte");
  });

  it("conta le tappe per ogni filtro", () => {
    expect(contaPerStato(tappe)).toEqual({
      tutte: 5,
      bozza: 1,
      iscrizioni_aperte: 2,
      iscrizioni_chiuse: 0,
      in_corso: 1,
      conclusa: 1,
      annullata: 0,
    });
  });
});

describe("conteggio dei posti", () => {
  it("posti liberi quando restano posti", () => {
    const posti = contaPosti({ iscritti: 12, posti: 16 });
    expect(posti).toEqual({
      iscritti: 12,
      posti: 16,
      liberi: 4,
      inEccesso: 0,
      completo: false,
    });
    expect(descriviPosti(posti)).toBe("4 posti liberi");
  });

  it("al singolare con un solo posto", () => {
    expect(descriviPosti(contaPosti({ iscritti: 15, posti: 16 }))).toBe(
      "1 posto libero",
    );
  });

  it("completo quando gli iscritti sono pari ai posti", () => {
    const posti = contaPosti({ iscritti: 16, posti: 16 });
    expect(posti.completo).toBe(true);
    expect(posti.liberi).toBe(0);
    expect(descriviPosti(posti)).toBe("Completo");
  });

  it("gli iscritti oltre i posti non rendono negativi i posti liberi", () => {
    const posti = contaPosti({ iscritti: 18, posti: 16 });
    expect(posti.liberi).toBe(0);
    expect(posti.inEccesso).toBe(2);
    expect(descriviPosti(posti)).toBe("Completo · 2 in eccesso");
  });

  it("nessun iscritto: tutti i posti liberi", () => {
    expect(contaPosti({ iscritti: 0, posti: 24 }).liberi).toBe(24);
  });

  it("valori negativi contano come zero", () => {
    expect(contaPosti({ iscritti: -3, posti: -1 })).toEqual({
      iscritti: 0,
      posti: 0,
      liberi: 0,
      inEccesso: 0,
      completo: true,
    });
  });
});

describe("giorno di gara e partite da inserire", () => {
  const base = { data_inizio: "2027-06-14", data_fine: "2027-06-15" };

  it("solo una tappa in corso con la data di oggi nel suo periodo", () => {
    expect(isGiornoDiGara({ ...base, stato: "in_corso" }, "2027-06-14")).toBe(
      true,
    );
    expect(isGiornoDiGara({ ...base, stato: "in_corso" }, "2027-06-15")).toBe(
      true,
    );
    expect(isGiornoDiGara({ ...base, stato: "in_corso" }, "2027-06-16")).toBe(
      false,
    );
    expect(
      isGiornoDiGara({ ...base, stato: "iscrizioni_chiuse" }, "2027-06-14"),
    ).toBe(false);
  });

  it("singolare e plurale", () => {
    expect(partiteDaInserireLabel(1)).toBe("1 partita da inserire");
    expect(partiteDaInserireLabel(0)).toBe("0 partite da inserire");
    expect(partiteDaInserireLabel(4)).toBe("4 partite da inserire");
  });

  const row: AdminTappaRpcRow = {
    id: "t1",
    nome: "Tappa 1 · Jesolo",
    ...base,
    stato: "in_corso",
    categorie: [
      { categoria: "F", posti: 16, fase: "silver", iscritti: 12 },
      { categoria: "M", posti: 16, fase: "gold", iscritti: 16 },
    ],
    partite_da_inserire: 3,
  };

  it("converte la riga della RPC, con M prima di F", () => {
    const tappa = toAdminTappa(row, "2027-06-14");
    expect(tappa).toMatchObject({
      id: "t1",
      periodo: "14–15 giugno",
      partiteDaInserire: 3,
      giornoDiGara: true,
    });
    expect(tappa.categorie.map((c) => c.categoria)).toEqual(["M", "F"]);
    expect(tappa.categorie[0]).toEqual({
      categoria: "M",
      posti: 16,
      fase: "gold",
      iscritti: 16,
    });
  });

  it("una categoria mancante vale zero posti e nessuna fase", () => {
    const tappa = toAdminTappa(
      { ...row, categorie: [row.categorie[1]] },
      "2027-06-14",
    );
    expect(tappa.categorie[1]).toEqual({
      categoria: "F",
      posti: 0,
      fase: null,
      iscritti: 0,
    });
  });

  it("il banner conta solo le tappe in gara oggi", () => {
    const oggi = toAdminTappa(row, "2027-06-14");
    const altra = toAdminTappa({ ...row, id: "t2" }, "2027-07-01");
    expect(partiteDaInserireOggi([oggi, altra])).toEqual([
      { id: "t1", label: "Tappa 1 · Jesolo", count: 3 },
    ]);
  });
});
