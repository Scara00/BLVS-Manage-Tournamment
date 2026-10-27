import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SPAREGGIO_MESSAGES,
  leggiClassificaGirone,
  risolviParitaGirone,
  toPartitaGirone,
  type PartitaGironeRow,
} from "./dati";

const uno = (
  id: string,
  x: string,
  y: string,
  sets: { a: number; b: number }[],
  stato: PartitaGironeRow["stato"] = "conclusa",
): PartitaGironeRow => ({
  id,
  stato,
  punteggi: { sets },
  partita_giocatori: [
    { iscrizione_id: x, squadra: "A" },
    { iscrizione_id: y, squadra: "B" },
  ],
});

// a and b both beat c and lose to d; their match is voided: perfect tie.
const PARTITE: PartitaGironeRow[] = [
  uno("p1", "a", "b", [{ a: 21, b: 10 }], "annullata"),
  uno("p2", "a", "c", [{ a: 21, b: 15 }]),
  uno("p3", "b", "c", [{ a: 21, b: 15 }]),
  uno("p4", "d", "a", [{ a: 21, b: 15 }]),
  uno("p5", "d", "b", [{ a: 21, b: 15 }]),
  uno("p6", "d", "c", [{ a: 21, b: 0 }]),
];
const FIRMA = "a:2/1/36/36|b:2/1/36/36";

let decisioni: { firma: string; ordine: string[] }[];
let girone: { id: string } | null;
const rpc = vi.fn();

/** A thenable stand-in for the PostgREST query builder. */
function query(data: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => builder,
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return builder;
}

const supabase = {
  from: (table: string) => {
    switch (table) {
      case "gironi":
        return query(girone);
      case "girone_iscrizioni":
        return query(
          ["a", "b", "c", "d"].map((iscrizione_id) => ({ iscrizione_id })),
        );
      case "partite":
        return query(PARTITE);
      case "spareggi_girone":
        return query(decisioni);
    }
    throw new Error(table);
  },
  rpc: (...args: unknown[]) => rpc(...args),
} as unknown as SupabaseClient;

const input = {
  gironeId: "g1",
  firma: FIRMA,
  ordine: ["b", "a"],
  motivo: "  Sorteggio  ",
};

beforeEach(() => {
  decisioni = [];
  girone = { id: "g1" };
  rpc.mockReset();
  rpc.mockImplementation(async () => {
    decisioni = [{ firma: FIRMA, ordine: ["b", "a"] }];
    return { data: null, error: null };
  });
});

describe("toPartitaGirone", () => {
  it("divide i giocatori per squadra e accetta l'embed come array", () => {
    const partita = toPartitaGirone({
      ...PARTITE[1],
      punteggi: [{ sets: [{ a: 21, b: 15 }] }],
    });
    expect(partita).toEqual({
      id: "p2",
      stato: "conclusa",
      squadre: { A: ["a"], B: ["c"] },
      sets: [{ a: 21, b: 15 }],
    });
    expect(toPartitaGirone({ ...PARTITE[1], punteggi: null }).sets).toEqual([]);
  });
});

describe("leggiClassificaGirone", () => {
  it("restituisce null per un girone che non esiste", async () => {
    girone = null;
    expect(await leggiClassificaGirone(supabase, "g1")).toBeNull();
  });

  it("segnala la parità perfetta e poi applica la decisione salvata", async () => {
    const aperta = await leggiClassificaGirone(supabase, "g1");
    expect(aperta?.parita.map((p) => p.firma)).toEqual([FIRMA]);
    decisioni = [{ firma: FIRMA, ordine: ["b", "a"] }];
    const decisa = await leggiClassificaGirone(supabase, "g1");
    expect(decisa?.stato).toBe("completo");
  });
});

describe("risolviParitaGirone", () => {
  it("salva l'ordine con il motivo ripulito e rilegge la classifica", async () => {
    const esito = await risolviParitaGirone(supabase, input);
    expect(rpc).toHaveBeenCalledWith("risolvi_parita_girone", {
      p_girone: "g1",
      p_firma: FIRMA,
      p_ordine: ["b", "a"],
      p_motivo: "Sorteggio",
    });
    expect(
      esito.ok && esito.classifica.righe.map((r) => r.iscrizioneId),
    ).toEqual(["d", "b", "a", "c"]);
  });

  it.each([
    [{ motivo: "  " }, "invalid", SPAREGGIO_MESSAGES.motivoMancante],
    [{ motivo: "x".repeat(501) }, "invalid", SPAREGGIO_MESSAGES.motivoLungo],
    [{ ordine: ["a", "c"] }, "invalid", SPAREGGIO_MESSAGES.ordineNonValido],
    [
      { firma: "a:1/1/21/0|b:1/1/21/0" },
      "conflict",
      SPAREGGIO_MESSAGES.conflict,
    ],
  ])("non chiama il database se %o", async (diff, reason, message) => {
    const esito = await risolviParitaGirone(supabase, { ...input, ...diff });
    expect(esito).toEqual({ ok: false, reason, message });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    [
      { code: "42501" },
      "permissionDenied",
      SPAREGGIO_MESSAGES.permissionDenied,
    ],
    [
      { code: "23514", hint: "tappa_archiviata" },
      "conflict",
      SPAREGGIO_MESSAGES.archiviata,
    ],
    [
      { code: "23514", hint: "ordine_non_valido" },
      "invalid",
      SPAREGGIO_MESSAGES.ordineNonValido,
    ],
  ])("traduce l'errore del database %o", async (error, reason, message) => {
    rpc.mockResolvedValue({ data: null, error });
    const esito = await risolviParitaGirone(supabase, input);
    expect(esito).toEqual({ ok: false, reason, message });
  });

  it("un errore imprevisto diventa «network» e finisce nel log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({
      data: null,
      error: { code: "08006", message: "down" },
    });
    const esito = await risolviParitaGirone(supabase, input);
    expect(esito).toMatchObject({ ok: false, reason: "network" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
