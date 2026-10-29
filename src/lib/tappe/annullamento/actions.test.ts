// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  accodaEmail: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));
vi.mock("@/lib/email/queue", () => ({ accodaEmail: mocks.accodaEmail }));

const { annullaTappa, archiviaTappa } = await import("./actions");
const {
  ANNULLAMENTO_MESSAGES,
  initialAnnullaTappaState,
  initialArchiviaTappaState,
} = await import("./state");

const ID = "00000000-0000-4000-8000-000000002201";

const supabase = {
  rpc: (name: string, args: unknown) => mocks.rpc(name, args),
  from: () => ({
    update: (values: unknown) => ({
      eq: () => ({ select: async () => mocks.update(values) }),
    }),
  }),
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function annulla(motivo = "Allerta meteo") {
  return annullaTappa(initialAnnullaTappaState, form({ tappaId: ID, motivo }));
}

function archivia() {
  return archiviaTappa(initialArchiviaTappaState, form({ tappaId: ID }));
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
    data: [{ email: "anna@example.it" }, { email: "bruno@example.it" }],
    error: null,
  });
  mocks.update.mockResolvedValue({ data: [{ id: ID }], error: null });
  utente();
});

describe("annullaTappa: avvisi via email sospesi", () => {
  it("annulla con il motivo e non accoda nessuna email", async () => {
    const state = await annulla("  Allerta meteo  ");

    expect(mocks.rpc).toHaveBeenCalledWith("annulla_tappa", {
      p_tappa: ID,
      p_motivo: "Allerta meteo",
    });
    expect(mocks.accodaEmail).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      status: "success",
      iscritti: 2,
      message:
        "Tappa annullata. Non parte nessuna email: se serve, avvisa tu i 2 iscritti.",
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("dice al singolare di avvisare l'unico iscritto", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ email: "anna@example.it" }],
      error: null,
    });
    expect(await annulla()).toMatchObject({
      iscritti: 1,
      message:
        "Tappa annullata. Non parte nessuna email: se serve, avvisa tu l'iscritto.",
    });
  });

  it("senza iscritti lo dice", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await annulla()).toMatchObject({
      status: "success",
      iscritti: 0,
      message: "Tappa annullata. Non c'erano iscritti.",
    });
  });
});

describe("annullaTappa: validazione e ruolo", () => {
  it.each(["", "   "])("il motivo è obbligatorio (%j)", async (motivo) => {
    expect(await annulla(motivo)).toMatchObject({
      status: "error",
      reason: "invalid",
      fields: { motivo: ANNULLAMENTO_MESSAGES.motivoMancante },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("un motivo troppo lungo è rifiutato", async () => {
    expect(await annulla("x".repeat(501))).toMatchObject({
      fields: { motivo: ANNULLAMENTO_MESSAGES.motivoLungo },
    });
  });

  it("un giocatore riceve permissionDenied", async () => {
    utente("giocatore");
    expect(await annulla()).toMatchObject({ reason: "permissionDenied" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("senza sessione: sessionExpired", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await annulla()).toMatchObject({ reason: "sessionExpired" });
  });

  it("senza database valida e poi risponde unavailable", async () => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    expect(await annulla("")).toMatchObject({ reason: "invalid" });
    expect(await annulla()).toMatchObject({ reason: "unavailable" });
  });

  it("una tappa conclusa non si annulla", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "tappa_non_annullabile" },
    });
    expect(await annulla()).toMatchObject({
      reason: "conflict",
      message: ANNULLAMENTO_MESSAGES.nonAnnullabile,
    });
    expect(mocks.accodaEmail).not.toHaveBeenCalled();
  });
});

describe("archiviaTappa", () => {
  it("rifiuta l'archiviazione prima della chiusura dei tabelloni", async () => {
    mocks.update.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "tabelloni_non_conclusi" },
    });
    expect(await archivia()).toMatchObject({
      status: "error",
      reason: "conflict",
      message: ANNULLAMENTO_MESSAGES.archiviaNonDisponibile,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("archivia quando il database lo permette", async () => {
    expect(await archivia()).toMatchObject({
      status: "success",
      message: ANNULLAMENTO_MESSAGES.archiviata,
    });
    expect(mocks.update).toHaveBeenCalledWith({ stato: "archiviata" });
  });

  it("nessuna riga aggiornata: conflitto", async () => {
    mocks.update.mockResolvedValue({ data: [], error: null });
    expect(await archivia()).toMatchObject({ reason: "conflict" });
  });
});
