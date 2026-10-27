// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
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

const { rigeneraGironi } = await import("./actions");
const { initialRigeneraState } = await import("./types");
const demo = await import("@/lib/demo/rigenera-gironi");
const editorDemo = await import("@/lib/demo/gironi-editor");

const TAPPA = "00000000-0000-4000-8000-000000000001";
const TABELLONE = "00000000-0000-4000-8000-0000000000aa";

/** Just enough of the Supabase client for the action. */
const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: TABELLONE }, error: null }),
        }),
      }),
    }),
  }),
  rpc: (name: string, args: unknown) => {
    const result = mocks.rpc(name, args);
    return Object.assign(Promise.resolve(result), {
      single: async () => result,
    });
  },
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function rigenera(values: Record<string, string> = {}) {
  return rigeneraGironi(
    initialRigeneraState,
    form({ tappaId: TAPPA, categoria: "M", attesi: "0", ...values }),
  );
}

const rigaPersa = {
  partita_id: "p1",
  girone: "Girone A",
  turno: 1,
  stato: "conclusa",
  sets: [{ a: 21, b: 18 }],
  squadra_a: ["A Uno", "A Due"],
  squadra_b: ["B Uno", "B Due"],
};

describe("rigeneraGironi con Supabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSupabaseEnv.mockReturnValue({ url: "x", key: "y" });
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "admin", supabase });
  });

  it("senza punteggi rigenera subito", async () => {
    mocks.rpc.mockReturnValue({
      data: { gironi: 4, punteggi_persi: 0 },
      error: null,
    });
    const state = await rigenera();
    expect(mocks.rpc).toHaveBeenCalledWith("rigenera_gironi", {
      p_tabellone: TABELLONE,
      p_conferma: false,
      p_attesi: 0,
    });
    expect(state).toMatchObject({ status: "success", persi: 0, gironi: 4 });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("con punteggi e senza spunta risponde con l'errore della casella", async () => {
    const state = await rigenera({ attesi: "3" });
    expect(state).toMatchObject({
      status: "fieldErrors",
      fields: {
        conferma: "Spunta la casella per confermare che perdi 3 punteggi.",
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("con la spunta passa conferma e conteggio visto e riporta i persi", async () => {
    mocks.rpc.mockReturnValue({
      data: { gironi: 2, punteggi_persi: 3 },
      error: null,
    });
    const state = await rigenera({ attesi: "3", conferma: "on" });
    expect(mocks.rpc).toHaveBeenCalledWith("rigenera_gironi", {
      p_tabellone: TABELLONE,
      p_conferma: true,
      p_attesi: 3,
    });
    expect(state).toMatchObject({
      status: "success",
      persi: 3,
      message:
        "Gironi rigenerati: 2 gironi. Persi 3 punteggi, annotati nel registro.",
    });
  });

  it("se i punteggi sono cambiati restituisce l'elenco aggiornato", async () => {
    mocks.rpc.mockImplementation((name: string) =>
      name === "rigenera_gironi"
        ? {
            data: null,
            error: { code: "23514", hint: "conferma_richiesta" },
          }
        : { data: [rigaPersa], error: null },
    );
    const state = await rigenera();
    expect(state).toMatchObject({ status: "error", reason: "conflict" });
    expect(state.status === "error" && state.punteggi).toHaveLength(1);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("rifiuta un giocatore e una sessione scaduta", async () => {
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "giocatore", supabase });
    expect(await rigenera()).toMatchObject({ reason: "permissionDenied" });
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await rigenera()).toMatchObject({ reason: "sessionExpired" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("riporta gli stati in cui non si rigenera", async () => {
    mocks.rpc.mockReturnValue({
      data: null,
      error: { code: "23514", hint: "tabellone_concluso" },
    });
    expect(await rigenera()).toMatchObject({
      status: "error",
      reason: "invalid",
      message:
        "Il tabellone è concluso: i gironi non si possono più rigenerare.",
    });
  });

  it("rifiuta una richiesta malformata", async () => {
    expect(await rigenera({ categoria: "X" })).toMatchObject({
      reason: "invalid",
    });
    expect(await rigenera({ attesi: "-1" })).toMatchObject({
      reason: "invalid",
    });
  });
});

describe("rigeneraGironi in demo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSupabaseEnv.mockReturnValue(null);
  });

  it("perde i punteggi solo dopo la conferma e fa crescere la versione", async () => {
    const { id } = demo.creaDemoRigenerazione({ punteggi: 2 });
    const prima = editorDemo.getDemoGironi(id, "M")!.composizione;
    expect(prima.bloccata).toBe(true);
    expect(demo.getDemoPunteggiPersi(id, "M")).toHaveLength(2);

    const senza = await rigeneraGironi(
      initialRigeneraState,
      form({ tappaId: id, categoria: "M", attesi: "0" }),
    );
    expect(senza).toMatchObject({ status: "error", reason: "conflict" });

    const state = await rigeneraGironi(
      initialRigeneraState,
      form({ tappaId: id, categoria: "M", attesi: "2", conferma: "on" }),
    );
    expect(state).toMatchObject({ status: "success", persi: 2, gironi: 4 });
    const dopo = editorDemo.getDemoGironi(id, "M")!.composizione;
    expect(dopo.versione).toBe(prima.versione + 1);
    expect(dopo.bloccata).toBe(false);
    expect(dopo.gironi.flatMap((g) => g.giocatori)).toHaveLength(16);
    expect(demo.getDemoPunteggiPersi(id, "M")).toEqual([]);
  });
});
