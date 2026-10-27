// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  ErroreRegistro,
  ETICHETTE_EVENTO_REGISTRO,
  TIPI_EVENTO_REGISTRO,
  formatOraRegistro,
  registraEvento,
  type VoceRegistro,
} from ".";

const MIGRATION = path.resolve(
  process.cwd(),
  "supabase/migrations/20261027200000_registro_eventi.sql",
);

const voce: VoceRegistro = {
  id: 7,
  tipo: "correzione_punteggio",
  attore_id: "00000000-0000-0000-0000-0000000000a1",
  entita: "punteggi",
  entita_id: "42",
  valore_prima: { set1: [21, 18] },
  valore_dopo: { set1: [21, 19] },
  nota: "Errore di battitura",
  created_at: "2026-07-12T14:05:00.000Z",
};

function fakeClient(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ single }));
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("registraEvento", () => {
  it("scrive l'evento con tipo, oggetto e valore prima e dopo", async () => {
    const { client, rpc } = fakeClient({ data: voce, error: null });

    const scritta = await registraEvento(client, {
      tipo: "correzione_punteggio",
      entita: "punteggi",
      entitaId: "42",
      valorePrima: { set1: [21, 18] },
      valoreDopo: { set1: [21, 19] },
      nota: "Errore di battitura",
    });

    expect(rpc).toHaveBeenCalledWith("registra_evento", {
      p_tipo: "correzione_punteggio",
      p_entita: "punteggi",
      p_entita_id: "42",
      p_valore_prima: { set1: [21, 18] },
      p_valore_dopo: { set1: [21, 19] },
      p_nota: "Errore di battitura",
      p_attore_id: null,
    });
    expect(scritta).toEqual(voce);
  });

  it("passa l'autore solo se indicato e manda null per i valori assenti", async () => {
    const { client, rpc } = fakeClient({ data: voce, error: null });

    await registraEvento(client, {
      tipo: "chiusura_tabellone",
      entita: "tabelloni",
      entitaId: "t1",
      attoreId: voce.attore_id,
    });

    expect(rpc).toHaveBeenCalledWith(
      "registra_evento",
      expect.objectContaining({
        p_valore_prima: null,
        p_valore_dopo: null,
        p_nota: null,
        p_attore_id: voce.attore_id,
      }),
    );
  });

  it("se il database rifiuta la scrittura lancia ErroreRegistro con il codice", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = fakeClient({
      data: null,
      error: { code: "42501", message: "Solo un admin" },
    });

    await expect(
      registraEvento(client, {
        tipo: "ritiro",
        entita: "iscrizioni",
        entitaId: "9",
      }),
    ).rejects.toEqual(expect.objectContaining({ code: "42501" }));
    await expect(
      registraEvento(client, { tipo: "ritiro", entita: "x", entitaId: "1" }),
    ).rejects.toBeInstanceOf(ErroreRegistro);
    error.mockRestore();
  });
});

describe("tipi di evento", () => {
  it("coincidono con l'enum tipo_evento_registro della migrazione", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const body =
      /create type public\.tipo_evento_registro as enum \(([^)]*)\)/.exec(
        sql,
      )?.[1];
    const valori = [...(body ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    // Values added later (e.g. BLVS-37) go at the end, in migration order.
    const dir = path.dirname(MIGRATION);
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const altre = readFileSync(path.join(dir, file), "utf8").matchAll(
        /alter type public\.tipo_evento_registro add value (?:if not exists )?'([^']+)'/g,
      );
      for (const m of altre) valori.push(m[1]);
    }
    expect(valori).toEqual([...TIPI_EVENTO_REGISTRO]);
  });

  it("hanno tutti un'etichetta in italiano", () => {
    for (const tipo of TIPI_EVENTO_REGISTRO) {
      expect(ETICHETTE_EVENTO_REGISTRO[tipo]).toMatch(/^[A-ZÀ-Ý]/);
    }
  });
});

describe("formatOraRegistro", () => {
  it("mostra data e ora in Europe/Rome, ora legale e solare", () => {
    expect(formatOraRegistro({ created_at: "2026-07-12T14:05:00.000Z" })).toBe(
      "12/07/26, 16:05:00",
    );
    expect(formatOraRegistro({ created_at: "2026-12-12T14:05:00.000Z" })).toBe(
      "12/12/26, 15:05:00",
    );
  });
});
