// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/session";

vi.mock("server-only", () => ({}));
const { getCurrentUser, rpc } = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));

const { POST } = await import("./route");

const ID = "3f1c7a52-8b0d-4c6e-9a7f-1d2e3f4a5b6c";

function call(id = ID) {
  return POST(
    new NextRequest(`https://blvs.example/api/admin/tappe/${id}/gironi`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("POST /api/admin/tappe/:id/gironi", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({
      id: "a1",
      email: "admin@example.it",
      ruolo: "admin",
      supabase: { rpc } as unknown as CurrentUser["supabase"],
    });
  });

  afterEach(() => {
    getCurrentUser.mockReset();
    rpc.mockReset();
  });

  it("genera e restituisce gironi, partite ed esclusi per categoria", async () => {
    const categorie = [
      { categoria: "F", gironi: 1, partite: 3, esclusi: [] },
      {
        categoria: "M",
        gironi: 2,
        partite: 6,
        esclusi: [
          {
            iscrizione_id: "i9",
            utente_id: "u9",
            nome: "Ivo",
            cognome: "Rossi",
            posto: 9,
          },
        ],
      },
    ];
    rpc.mockResolvedValue({ data: categorie, error: null });
    const res = await call();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ categorie });
    expect(rpc).toHaveBeenCalledWith("genera_gironi", { p_tappa: ID });
  });

  it.each([
    ["iscrizioni_non_chiuse", "I gironi si generano solo a iscrizioni chiuse."],
    ["partite_iniziate", "Le partite dei gironi sono già iniziate"],
  ])("rifiuta con 409 (%s)", async (hint, message) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", hint, message: "x" },
    });
    const res = await call();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain(message);
  });

  it("404 per una tappa che non esiste o un id non valido", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", message: "Tappa non trovata." },
    });
    expect((await call()).status).toBe(404);
    expect((await call("non-un-uuid")).status).toBe(404);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("un giocatore riceve 403 senza chiamare il database", async () => {
    getCurrentUser.mockResolvedValue({
      id: "g1",
      email: "g@example.it",
      ruolo: "giocatore",
      supabase: { rpc } as unknown as CurrentUser["supabase"],
    });
    expect((await call()).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
