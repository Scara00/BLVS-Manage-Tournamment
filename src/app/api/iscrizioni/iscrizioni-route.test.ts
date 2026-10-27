// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TAPPA = "6f1c2c1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

type DbError = { code: string; message: string; hint?: string };

/** Minimal PostgREST stand-in for the two RPCs the route calls. */
const db = vi.hoisted(() => ({
  confermata: false as boolean,
  rpcError: null as null | DbError,
  calls: [] as unknown[],
}));

function rpc(name: string, args?: unknown) {
  if (name === "email_confermata")
    return Promise.resolve({ data: db.confermata, error: null });
  db.calls.push({ name, args });
  const chain = {
    select: () => chain,
    single: async () =>
      db.rpcError
        ? { data: null, error: db.rpcError }
        : {
            data: {
              id: "iscr-1",
              tappa_id: TAPPA,
              stato: "in_attesa",
              posto: 7,
            },
            error: null,
          },
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
  db.confermata = true;
  db.rpcError = null;
  db.calls = [];
  getCurrentUser.mockReset();
  getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "nuovo@example.it",
    ruolo: "giocatore",
    supabase: { rpc },
  });
});

describe("POST /api/iscrizioni", () => {
  it("rifiuta l'iscrizione di chi non ha confermato l'email", async () => {
    db.confermata = false;
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Conferma la tua email prima di iscriverti a una tappa.",
    });
    expect(db.calls).toEqual([]);
  });

  it("iscrive con iscriviti_tappa e restituisce il posto", async () => {
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(201);
    expect(db.calls).toEqual([
      { name: "iscriviti_tappa", args: { p_tappa: TAPPA } },
    ]);
    expect((await res.json()).iscrizione).toMatchObject({ posto: 7 });
  });

  it("se il database rifiuta per la conferma, lo dice", async () => {
    db.rpcError = {
      code: "42501",
      message: "Conferma la tua email prima di iscriverti a una tappa",
    };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/^Conferma la tua email/);
  });

  it("seconda iscrizione alla stessa tappa: 409 con messaggio", async () => {
    db.rpcError = { code: "23505", message: "dup", hint: "gia_iscritto" };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Sei già iscritto a questa tappa.",
    });
  });

  it.each([
    ["posti_esauriti", /Posti esauriti/],
    ["chiuse", /chiuse/],
    ["scadute", /scadute/],
    ["annullata", /annullata/],
  ])("rifiuto %s: 409 con il motivo", async (hint, message) => {
    db.rpcError = { code: "23514", message: "x", hint };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(message);
  });

  it("bozza o tappa inesistente: 404 senza dati della tappa", async () => {
    db.rpcError = { code: "P0002", message: "Tappa non trovata." };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Tappa non trovata." });
  });

  it.each([
    ["tappa_annullata", "La tappa è annullata: non accetta nuove iscrizioni."],
    [
      "tappa_archiviata",
      "La tappa è archiviata: non accetta nuove iscrizioni.",
    ],
  ])("una tappa con hint %s risponde 409", async (hint, message) => {
    db.rpcError = { code: "23514", message: "bloccata", hint };
    const res = await post({ tappaId: TAPPA });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: message });
  });

  it("senza sessione risponde 403", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await post({ tappaId: TAPPA })).status).toBe(403);
  });

  it("valida la tappa e chiede la categoria", async () => {
    expect((await post({ tappaId: "x" })).status).toBe(422);
    db.rpcError = { code: "23514", message: "x", hint: "categoria_mancante" };
    expect((await post({ tappaId: TAPPA })).status).toBe(422);
  });
});
