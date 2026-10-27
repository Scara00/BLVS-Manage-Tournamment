// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  publishPhaseStarted: vi.fn(),
  pubblicaTabellone: vi.fn(),
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
vi.mock("@/lib/live/publish", () => ({
  publishPhaseStarted: mocks.publishPhaseStarted,
}));
vi.mock("@/lib/tappe/live-admin/pubblica", () => ({
  pubblicaTabellone: mocks.pubblicaTabellone,
}));

const { avviaFase } = await import("./actions");
const { AVVIO_MESSAGES, initialAvvioFaseState } = await import("./state");
const demo = await import("@/lib/demo/avvio-fase");

const ID = "00000000-0000-4000-8000-000000002901";

const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: {
            nome: "Tappa 3 · Cagliari",
            tabelloni: [
              { id: "tb-m", categoria: "M" },
              { id: "tb-f", categoria: "F" },
            ],
          },
          error: null,
        }),
      }),
    }),
  }),
  rpc: (...args: unknown[]) => mocks.rpc(...args),
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function avvia(values: Record<string, string> = {}) {
  return avviaFase(
    initialAvvioFaseState,
    form({ tappaId: ID, categoria: "m", ...values }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("avviaFase con il database", () => {
  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue({ url: "x", key: "y" });
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "admin", supabase });
  });

  it("avvia il tabellone scelto, avvisa le pagine live e ricarica", async () => {
    mocks.rpc.mockResolvedValue({ data: [{}, {}, {}], error: null });
    const state = await avvia();
    expect(mocks.rpc).toHaveBeenCalledWith("avvia_fase", {
      p_tabellone: "tb-m",
    });
    expect(state).toMatchObject({ status: "success", partite: 3 });
    expect(mocks.publishPhaseStarted).toHaveBeenCalledWith({
      id: `${ID}:M`,
      stageId: ID,
      label: "Tappa 3 · Cagliari, maschile",
      category: "M",
      phase: "gironi_iniziali",
      matches: 3,
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("restituisce gli errori del server, uno per girone", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23514",
        hint: "avvio_bloccato",
        details: JSON.stringify([
          {
            regola: "girone_non_da_4",
            girone_id: "g1",
            girone_nome: "Girone B",
            dettaglio: "3",
          },
        ]),
      },
    });
    const state = await avvia();
    expect(state).toMatchObject({
      status: "fieldErrors",
      message: AVVIO_MESSAGES.bloccato,
      errori: [
        {
          regola: "girone_non_da_4",
          gironeId: "g1",
          gironeNome: "Girone B",
          dettaglio: "3",
        },
      ],
    });
    expect(mocks.publishPhaseStarted).not.toHaveBeenCalled();
  });

  it.each([
    ["fase_gia_avviata", AVVIO_MESSAGES.giaAvviata],
    ["tappa_non_avviabile", AVVIO_MESSAGES.nonAvviabile],
    ["partite_iniziate", AVVIO_MESSAGES.partiteIniziate],
  ])("mappa l'hint %s", async (hint, message) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514", hint } });
    expect(await avvia()).toMatchObject({
      status: "error",
      reason: "conflict",
      message,
    });
  });

  it("42501 → permesso negato", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await avvia()).toMatchObject({ reason: "permissionDenied" });
  });

  it("un errore inatteso → rete", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockRejectedValue(new Error("boom"));
    expect(await avvia()).toMatchObject({ reason: "network" });
  });

  it("controlla il ruolo sul server", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "giocatore", supabase });
    expect(await avvia()).toMatchObject({ reason: "permissionDenied" });
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await avvia()).toMatchObject({ reason: "sessionExpired" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rifiuta una categoria non valida", async () => {
    expect(await avvia({ categoria: "x" })).toMatchObject({
      reason: "conflict",
    });
  });
});

describe("avviaFase senza database (demo)", () => {
  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue(null);
  });

  it("avvia un tabellone pronto e lo segna avviato", async () => {
    const id = demo.creaDemoAvvioFase("pronta");
    const state = await avviaFase(
      initialAvvioFaseState,
      form({ tappaId: id, categoria: "m" }),
    );
    expect(state).toMatchObject({ status: "success", partite: 6 });
    const dopo = demo.getDemoAvvioFase(id, "M")!;
    expect(dopo.faseGioco).toBe("gironi_iniziali");
    expect(dopo.tappa.stato).toBe("in_corso");
    expect(mocks.publishPhaseStarted).toHaveBeenCalled();

    const ancora = await avviaFase(
      initialAvvioFaseState,
      form({ tappaId: id, categoria: "m" }),
    );
    expect(ancora).toMatchObject({
      status: "error",
      message: AVVIO_MESSAGES.giaAvviata,
    });
  });

  it("rifiuta un tabellone con gironi da correggere", async () => {
    const id = demo.creaDemoAvvioFase("bloccata");
    const state = await avviaFase(
      initialAvvioFaseState,
      form({ tappaId: id, categoria: "m" }),
    );
    expect(state.status).toBe("fieldErrors");
    if (state.status !== "fieldErrors") return;
    expect(state.errori.map((e) => e.regola)).toEqual([
      "girone_non_da_4",
      "non_assegnato",
    ]);
    expect(demo.getDemoAvvioFase(id, "M")!.faseGioco).toBeNull();
  });
});
