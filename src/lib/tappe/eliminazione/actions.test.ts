// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  pubblica: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));
vi.mock("@/lib/classifica-generale/pubblica", () => ({
  pubblicaClassificaStagione: mocks.pubblica,
}));

const { eliminaTappa } = await import("./actions");
const { ELIMINAZIONE_MESSAGES: M, initialEliminaTappaState } =
  await import("./state");

const ID = "00000000-0000-4000-8000-000000002201";

const supabase = {
  rpc: (name: string, args: unknown) => mocks.rpc(name, args),
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function elimina(conferma = "ELIMINA", tappaId = ID) {
  return eliminaTappa(initialEliminaTappaState, form({ tappaId, conferma }));
}

function utente(ruolo: "admin" | "giocatore" = "admin") {
  mocks.getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "admin@example.it",
    ruolo,
    supabase,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSupabaseEnv.mockReturnValue({ url: "x", publishableKey: "y" });
  mocks.rpc.mockResolvedValue({
    data: { nome: "Tappa 2 · Rimini", stagione: 2026, in_classifica: true },
    error: null,
  });
  utente();
});

describe("eliminaTappa", () => {
  it("elimina la tappa e ripubblica la classifica della sua stagione", async () => {
    const state = await elimina(" elimina ");

    expect(mocks.rpc).toHaveBeenCalledWith("elimina_tappa", { p_tappa: ID });
    expect(mocks.pubblica).toHaveBeenCalledWith(
      2026,
      "Tappa 2 · Rimini: tappa eliminata",
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(state).toMatchObject({
      status: "success",
      message: "Tappa «Tappa 2 · Rimini» eliminata.",
    });
  });

  it("una tappa fuori classifica non ripubblica nulla", async () => {
    mocks.rpc.mockResolvedValue({
      data: { nome: "Bozza", stagione: 2026, in_classifica: false },
      error: null,
    });
    expect(await elimina()).toMatchObject({ status: "success" });
    expect(mocks.pubblica).not.toHaveBeenCalled();
  });

  it("senza ELIMINA non parte nulla", async () => {
    expect(await elimina("")).toMatchObject({
      status: "error",
      reason: "invalid",
      fields: { conferma: M.confermaMancante },
    });
    expect(await elimina("cancella")).toMatchObject({
      fields: { conferma: M.confermaErrata },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("demo senza database: non salva", async () => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    expect(await elimina()).toMatchObject({ reason: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("sessione scaduta e giocatore vengono fermati prima del database", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await elimina()).toMatchObject({ reason: "sessionExpired" });
    utente("giocatore");
    expect(await elimina()).toMatchObject({ reason: "permissionDenied" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("una tappa già sparita è un conflitto", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0002", hint: "tappa_non_trovata", message: "x" },
    });
    expect(await elimina()).toMatchObject({
      reason: "conflict",
      message: M.conflict,
    });
    expect(await elimina("ELIMINA", "non-un-uuid")).toMatchObject({
      reason: "conflict",
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("un errore del database non elimina e non ripubblica", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await elimina()).toMatchObject({
      reason: "network",
      message: M.network,
    });
    expect(mocks.pubblica).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
