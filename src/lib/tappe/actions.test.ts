// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  update: vi.fn(),
  eqs: [] as [string, unknown][],
  row: null as Record<string, unknown> | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));

const { aggiornaScadenzaTappa, cambiaStatoTappa } = await import("./actions");
const { GESTIONE_MESSAGES, initialCambioStatoState, initialScadenzaState } =
  await import("./gestione-state");
const demo = await import("@/lib/demo/gestione-tappe");

const ID = "00000000-0000-4000-8000-000000001002";

/** Just enough of the Supabase client: `update().eq().eq().select()`. */
const supabase = {
  from: () => ({
    update: (values: unknown) => {
      const chain = {
        eq: (column: string, value: unknown) => {
          mocks.eqs.push([column, value]);
          return chain;
        },
        select: async () => mocks.update(values),
      };
      return chain;
    },
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: mocks.row, error: null }),
      }),
    }),
  }),
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function apri(values: Record<string, string> = {}) {
  return cambiaStatoTappa(
    initialCambioStatoState,
    form({ tappaId: ID, da: "bozza", a: "iscrizioni_aperte", ...values }),
  );
}

function admin(ruolo: "admin" | "giocatore" = "admin") {
  mocks.getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "a@example.it",
    ruolo,
    supabase,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eqs = [];
  mocks.row = null;
  mocks.readSupabaseEnv.mockReturnValue({ url: "x", publishableKey: "y" });
  mocks.update.mockResolvedValue({ data: [{ id: ID }], error: null });
  admin();
  vi.setSystemTime(new Date("2027-05-01T10:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cambiaStatoTappa: ruolo verificato sul server", () => {
  it("un giocatore riceve permissionDenied e nessuna scrittura", async () => {
    admin("giocatore");
    expect(await apri()).toMatchObject({
      status: "error",
      reason: "permissionDenied",
      message: GESTIONE_MESSAGES.permissionDenied,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("senza sessione: sessionExpired", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await apri()).toMatchObject({ reason: "sessionExpired" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("se la verifica fallisce tratta l'utente come non autenticato", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.getCurrentUser.mockRejectedValue(new Error("boom"));
    expect(await apri()).toMatchObject({ reason: "sessionExpired" });
  });
});

describe("cambiaStatoTappa", () => {
  it("l'admin apre le iscrizioni: aggiorna solo se lo stato è ancora quello letto", async () => {
    expect(await apri()).toMatchObject({
      status: "success",
      stato: "iscrizioni_aperte",
    });
    expect(mocks.update).toHaveBeenCalledWith({ stato: "iscrizioni_aperte" });
    expect(mocks.eqs).toEqual([
      ["id", ID],
      ["stato", "bozza"],
    ]);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("rifiuta una transizione non permessa senza scrivere", async () => {
    expect(await apri({ a: "iscrizioni_chiuse" })).toMatchObject({
      reason: "invalid",
      message: GESTIONE_MESSAGES.transizione,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("0 righe aggiornate = conflitto (cambiata nel frattempo)", async () => {
    mocks.update.mockResolvedValue({ data: [], error: null });
    expect(await apri()).toMatchObject({ reason: "conflict" });
  });

  it("il trigger rifiuta l'apertura senza scadenza futura", async () => {
    mocks.update.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "scadenza_mancante" },
    });
    const state = await apri();
    expect(state).toMatchObject({ reason: "invalid" });
    if (state.status === "error")
      expect(state.message).toMatch(/scadenza futura/);
  });

  it("un errore del database diventa «network»", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.update.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await apri()).toMatchObject({
      reason: "network",
      message: GESTIONE_MESSAGES.network,
    });
  });
});

describe("aggiornaScadenzaTappa", () => {
  function salva(chiudonoIl: string) {
    return aggiornaScadenzaTappa(
      initialScadenzaState,
      form({ tappaId: ID, chiudonoIl }),
    );
  }

  beforeEach(() => {
    mocks.row = {
      stato: "bozza",
      data_inizio: "2027-06-26",
      iscrizioni_aprono_il: null,
    };
  });

  it("salva l'ora italiana come istante", async () => {
    expect(await salva("2027-06-19T23:59")).toMatchObject({
      status: "success",
    });
    expect(mocks.update).toHaveBeenCalledWith({
      iscrizioni_chiudono_il: "2027-06-19T21:59:00.000Z",
    });
  });

  it("errore sul campo per una scadenza passata", async () => {
    expect(await salva("2027-04-01T10:00")).toMatchObject({
      status: "error",
      reason: "invalid",
      fields: { chiudonoIl: "La scadenza deve essere nel futuro." },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("dopo la chiusura la scadenza non si cambia più", async () => {
    mocks.row = { ...mocks.row, stato: "iscrizioni_chiuse" };
    expect(await salva("2027-06-19T23:59")).toMatchObject({
      reason: "conflict",
    });
  });

  it("un giocatore non la cambia", async () => {
    admin("giocatore");
    expect(await salva("2027-06-19T23:59")).toMatchObject({
      reason: "permissionDenied",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("senza Supabase (demo, e2e)", () => {
  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue(null);
  });

  it("bozza → aperte → chiuse sul negozio in memoria", async () => {
    const id = demo.creaDemoTappa({ chiudonoIl: "2027-06-19T21:59:00Z" });
    const passo = (da: string, a: string) =>
      cambiaStatoTappa(initialCambioStatoState, form({ tappaId: id, da, a }));

    expect(await passo("bozza", "iscrizioni_aperte")).toMatchObject({
      status: "success",
    });
    expect(await passo("bozza", "iscrizioni_aperte")).toMatchObject({
      reason: "conflict",
    });
    expect(await passo("iscrizioni_aperte", "iscrizioni_chiuse")).toMatchObject(
      { status: "success" },
    );
    expect(demo.getDemoTappaGestione(id)?.row).toMatchObject({
      stato: "iscrizioni_chiuse",
      chiusura_automatica: false,
    });
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });

  it("chiusura automatica alla scadenza", () => {
    const id = demo.creaDemoTappa({
      stato: "iscrizioni_aperte",
      chiudonoIl: "2027-04-30T10:00:00Z",
    });
    expect(
      demo.chiudiDemoScadute(new Date("2027-05-01T10:00:00Z")),
    ).toBeGreaterThan(0);
    expect(demo.getDemoTappaGestione(id)?.row).toMatchObject({
      stato: "iscrizioni_chiuse",
      chiusura_automatica: true,
    });
  });
});
