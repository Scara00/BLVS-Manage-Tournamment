// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TappaModifica } from "./types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readRow: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  env: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({ readSupabaseEnv: mocks.env }));
vi.mock("./read", () => ({ readTappaModificaRow: mocks.readRow }));

const { aggiornaTappa } = await import("./actions");
const { TAPPA_MODIFICA_MESSAGES, initialTappaModificaFormState } =
  await import("./types");

const ID = "7d3b6a52-6f4f-4a51-9b41-0f3c0a6f2e11";

const tappa: TappaModifica = {
  id: ID,
  nome: "Tappa 2 · Rimini",
  luogo: "Rimini, Bagno 26",
  data: "2099-06-28",
  dataFine: "2099-06-29",
  scadenza: "2099-06-24T20:00",
  stato: "iscrizioni_aperte",
  versione: 3,
  tabelloni: {
    M: { posti: 16, iscritti: 12 },
    F: { posti: 16, iscritti: 9 },
  },
};

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    id: ID,
    versione: "3",
    nome: tappa.nome,
    luogo: tappa.luogo,
    data: tappa.data,
    scadenza: tappa.scadenza,
    postiM: "16",
    postiF: "20",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function salva(overrides?: Record<string, string>) {
  return aggiornaTappa(initialTappaModificaFormState, form(overrides));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.mockReturnValue({ url: "http://x", key: "k" });
  mocks.getCurrentUser.mockResolvedValue({
    id: "admin",
    email: "admin@example.it",
    ruolo: "admin",
    supabase: { rpc: mocks.rpc },
  });
  mocks.readRow.mockResolvedValue(tappa);
  mocks.rpc.mockResolvedValue({ data: 4, error: null });
});

describe("aggiornaTappa", () => {
  it("salva tramite modifica_tappa con la versione letta", async () => {
    const salvata = { ...tappa, versione: 4 };
    mocks.readRow.mockResolvedValueOnce(tappa).mockResolvedValueOnce(salvata);
    const state = await salva();
    expect(mocks.rpc).toHaveBeenCalledWith("modifica_tappa", {
      p_id: ID,
      p_versione: 3,
      p_nome: tappa.nome,
      p_luogo: tappa.luogo,
      p_data: "2099-06-28",
      p_scadenza: "2099-06-24T18:00:00.000Z",
      p_posti_m: 16,
      p_posti_f: 20,
    });
    expect(state).toEqual({
      status: "success",
      message: TAPPA_MODIFICA_MESSAGES.saved,
      tappa: salvata,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/tappe/${ID}/modifica`,
    );
  });

  it("blocca il massimo sotto gli iscritti senza chiamare il database", async () => {
    const state = await salva({ postiM: "10" });
    expect(state).toEqual({
      status: "error",
      message: TAPPA_MODIFICA_MESSAGES.invalid,
      fields: { postiM: "Il massimo non può scendere sotto 12" },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("mappa il blocco del trigger sul campo del tabellone", async () => {
    // A registration arrived between the read and the save.
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "23514",
        hint: "posti_sotto_iscritti",
        details: "F:21",
        message: "Il massimo non può scendere sotto 21",
      },
    });
    expect(await salva()).toEqual({
      status: "error",
      message: TAPPA_MODIFICA_MESSAGES.invalid,
      fields: { postiF: "Il massimo non può scendere sotto 21" },
    });
  });

  it("conflitto di versione: la versione inviata è vecchia", async () => {
    const nuova = { ...tappa, nome: "Rimini (spostata)", versione: 5 };
    mocks.readRow.mockResolvedValue(nuova);
    expect(await salva()).toEqual({
      status: "conflict",
      message: TAPPA_MODIFICA_MESSAGES.conflict,
      tappa: nuova,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("conflitto di versione: qualcuno salva tra la lettura e l'RPC", async () => {
    const nuova = { ...tappa, versione: 4 };
    mocks.readRow.mockResolvedValueOnce(tappa).mockResolvedValueOnce(nuova);
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "40001",
        hint: "versione_superata",
        details: "4",
        message: "",
      },
    });
    expect(await salva()).toEqual({
      status: "conflict",
      message: TAPPA_MODIFICA_MESSAGES.conflict,
      tappa: nuova,
    });
  });

  it("senza sessione chiede di accedere di nuovo", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await salva()).toEqual({
      status: "sessionExpired",
      message: TAPPA_MODIFICA_MESSAGES.sessionExpired,
    });
  });

  it("un giocatore non può salvare", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "u1",
      email: "marco@example.it",
      ruolo: "giocatore",
      supabase: { rpc: mocks.rpc },
    });
    expect(await salva()).toEqual({
      status: "permissionDenied",
      message: TAPPA_MODIFICA_MESSAGES.permissionDenied,
    });
    expect(mocks.readRow).not.toHaveBeenCalled();
  });

  it("una tappa in corso non si modifica", async () => {
    mocks.readRow.mockResolvedValue({ ...tappa, stato: "in_corso" });
    expect(await salva()).toMatchObject({ status: "nonModificabile" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("senza database configurato non salva", async () => {
    mocks.env.mockReturnValue(null);
    expect(await salva()).toMatchObject({ status: "unavailable" });
  });

  it("un errore inatteso dà un messaggio generico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "XX000", message: "boom" },
    });
    expect(await salva()).toEqual({
      status: "error",
      message: TAPPA_MODIFICA_MESSAGES.failed,
      fields: {},
    });
  });
});
