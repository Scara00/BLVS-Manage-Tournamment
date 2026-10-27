// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TAPPA = "6f1c2c1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

/** Minimal PostgREST stand-in: answers per table, records inserts. */
const db = vi.hoisted(() => ({
  confermata: false as boolean,
  categoria: "M" as string | null,
  insertError: null as null | {
    code: string;
    message: string;
    hint?: string;
  },
  inserts: [] as unknown[],
}));

function query(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    insert: (row: unknown) => {
      db.inserts.push(row);
      return chain;
    },
    maybeSingle: async () => {
      if (table === "utenti")
        return { data: { categoria: db.categoria }, error: null };
      if (table === "tabelloni")
        return { data: { id: "board-m" }, error: null };
      return { data: null, error: null };
    },
    single: async () =>
      db.insertError
        ? { data: null, error: db.insertError }
        : { data: { id: "iscr-1", stato: "in_attesa" }, error: null },
  };
  return chain;
}

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(
    new NextRequest("https://blvs.example/api/iscrizioni", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  db.confermata = false;
  db.categoria = "M";
  db.insertError = null;
  db.inserts = [];
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "nuovo@example.it",
    ruolo: "giocatore",
    supabase: {
      rpc: async (name: string) =>
        name === "email_confermata"
          ? { data: db.confermata, error: null }
          : { data: null, error: { code: "42883" } },
      from: query,
    },
  });
});

describe("POST /api/iscrizioni", () => {
  it("rifiuta l'iscrizione di chi non ha confermato l'email", async () => {
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Conferma la tua email prima di iscriverti a una tappa.",
    });
    expect(db.inserts).toEqual([]);
  });

  it("iscrive al tabellone della propria categoria dopo la conferma", async () => {
    db.confermata = true;
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(201);
    expect(db.inserts).toEqual([
      { tappa_id: TAPPA, tabellone_id: "board-m", utente_id: "u1" },
    ]);
  });

  it("se il database rifiuta per la conferma, lo dice", async () => {
    db.confermata = true;
    db.insertError = {
      code: "42501",
      message: "Conferma la tua email prima di iscriverti a una tappa",
    };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/^Conferma la tua email/);
  });

  it("risponde 409 a chi è già iscritto", async () => {
    db.confermata = true;
    db.insertError = { code: "23505", message: "duplicate" };
    expect((await post({ tappaId: TAPPA })).status).toBe(409);
  });

  it.each([
    ["tappa_annullata", "La tappa è annullata: non accetta nuove iscrizioni."],
    [
      "tappa_archiviata",
      "La tappa è archiviata: non accetta nuove iscrizioni.",
    ],
  ])("una tappa con hint %s risponde 409", async (hint, message) => {
    db.confermata = true;
    db.insertError = { code: "23514", message: "bloccata", hint };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: message });
  });

  it("senza sessione risponde 403", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await post({ tappaId: TAPPA })).status).toBe(403);
  });

  it("valida la tappa e chiede la categoria", async () => {
    db.confermata = true;
    expect((await post({ tappaId: "x" })).status).toBe(422);
    db.categoria = null;
    expect((await post({ tappaId: TAPPA })).status).toBe(422);
  });
});
