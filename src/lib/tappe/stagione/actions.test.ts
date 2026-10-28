// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
  pubblica: vi.fn(),
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
  pubblicaClassificaGenerale: mocks.pubblica,
}));
vi.mock("@/lib/classifica-generale/read", () => ({
  calcolaClassificaGenerale: vi.fn(async () => ({
    id: "M:2025",
    category: "M",
    season: 2025,
    rows: [],
  })),
}));

const { impostaStagioneTappa } = await import("./actions");
const { getDemoStagione } = await import("./demo");
const { initialStagioneState, STAGIONE_MESSAGES } = await import("./types");

const ID = "00000000-0000-4000-8000-000000001002";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

const supabase = {
  rpc: mocks.rpc,
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { stagione: 2026 }, error: null }),
      }),
    }),
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSupabaseEnv.mockReturnValue({ url: "x", anonKey: "y" });
  mocks.getCurrentUser.mockResolvedValue({
    id: "admin",
    ruolo: "admin",
    supabase,
  });
  mocks.rpc.mockResolvedValue({ data: 3, error: null });
});

describe("impostaStagioneTappa", () => {
  it("rifiuta un anno non valido senza chiamare il database", async () => {
    const esito = await impostaStagioneTappa(
      initialStagioneState,
      form({ tappaId: ID, stagione: "26" }),
    );
    expect(esito).toMatchObject({
      status: "error",
      reason: "invalid",
      campo: STAGIONE_MESSAGES.invalida,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("salva con la RPC e ripubblica la classifica generale", async () => {
    const esito = await impostaStagioneTappa(
      initialStagioneState,
      form({ tappaId: ID, stagione: "2025" }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("imposta_stagione_tappa", {
      p_tappa: ID,
      p_stagione: 2025,
    });
    expect(esito).toMatchObject({ status: "success", stagione: 2025 });
    expect(mocks.pubblica).toHaveBeenCalledWith(ID);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("solo l'admin; una tappa archiviata non cambia", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: "g",
      ruolo: "giocatore",
      supabase,
    });
    expect(
      await impostaStagioneTappa(
        initialStagioneState,
        form({ tappaId: ID, stagione: "2025" }),
      ),
    ).toMatchObject({ reason: "permissionDenied" });

    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", hint: "tappa_archiviata" },
    });
    expect(
      await impostaStagioneTappa(
        initialStagioneState,
        form({ tappaId: ID, stagione: "2025" }),
      ),
    ).toMatchObject({ message: STAGIONE_MESSAGES.archiviata });

    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect(
      await impostaStagioneTappa(
        initialStagioneState,
        form({ tappaId: ID, stagione: "2025" }),
      ),
    ).toMatchObject({ reason: "sessionExpired" });
  });

  it("senza Supabase salva nella tappa demo", async () => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    expect(getDemoStagione("rimini", "2026-06-20")).toBe(2026);
    const esito = await impostaStagioneTappa(
      initialStagioneState,
      form({ tappaId: "rimini", stagione: "2027" }),
    );
    expect(esito).toMatchObject({ status: "success", stagione: 2027 });
    expect(getDemoStagione("rimini", "2026-06-20")).toBe(2027);
  });
});
