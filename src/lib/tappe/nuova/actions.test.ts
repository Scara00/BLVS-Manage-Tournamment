// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));

const { creaTappa } = await import("./actions");
const { NUOVA_TAPPA_MESSAGES: M, initialNuovaTappaFormState } =
  await import("./types");

const supabase = { rpc: (...args: unknown[]) => mocks.rpc(...args) };

const valida = {
  nome: "Tappa 4 · Lignano",
  luogo: "Lignano, Bagno 3",
  data: "2027-11-14",
  scadenza: "2027-11-07T23:59",
  postiM: "20",
  postiF: "32",
};

function crea(values: Record<string, string> = valida) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return creaTappa(initialNuovaTappaFormState, data);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2027-10-27T08:00:00Z"));
  mocks.readSupabaseEnv.mockReturnValue({ url: "x", key: "y" });
  mocks.getCurrentUser.mockResolvedValue({
    id: "a1",
    email: "admin@example.it",
    ruolo: "admin",
    supabase,
  });
  mocks.rpc.mockResolvedValue({ data: "t1", error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("creaTappa", () => {
  it("crea la tappa con i posti di ciascun tabellone", async () => {
    await expect(crea()).resolves.toEqual({
      status: "success",
      message: M.created,
      id: "t1",
      href: "/admin",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("crea_tappa", {
      p_nome: "Tappa 4 · Lignano",
      p_luogo: "Lignano, Bagno 3",
      p_data: "2027-11-14",
      p_scadenza: "2027-11-07T22:59:00.000Z",
      p_posti_m: 20,
      p_posti_f: 32,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("senza sessione restituisce sessionExpired", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(crea()).resolves.toEqual({
      status: "sessionExpired",
      message: M.sessionExpired,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("un giocatore riceve permissionDenied", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "g1",
      email: "g@example.it",
      ruolo: "giocatore",
      supabase,
    });
    await expect(crea()).resolves.toMatchObject({
      status: "permissionDenied",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("restituisce gli errori dei campi senza chiamare il database", async () => {
    await expect(
      crea({ ...valida, nome: "", data: "2027-10-01" }),
    ).resolves.toEqual({
      status: "error",
      message: M.invalid,
      fields: {
        nome: "Campo obbligatorio.",
        data: M.dataPassata,
        scadenza: M.scadenzaDopoTappa,
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("mappa il vincolo sulla scadenza del database sul campo", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "scadenza_dopo_tappa", message: "x" },
    });
    await expect(crea()).resolves.toEqual({
      status: "error",
      message: M.invalid,
      fields: { scadenza: M.scadenzaDopoTappa },
    });
  });

  it("un errore inatteso dà un messaggio generico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", hint: "", message: "boom" },
    });
    await expect(crea()).resolves.toEqual({
      status: "error",
      message: M.failed,
      fields: {},
    });
  });

  it("senza database valida comunque, poi risponde unavailable", async () => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    await expect(crea({ ...valida, luogo: "" })).resolves.toMatchObject({
      status: "error",
      fields: { luogo: "Campo obbligatorio." },
    });
    await expect(crea()).resolves.toEqual({
      status: "unavailable",
      message: M.unavailable,
    });
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
