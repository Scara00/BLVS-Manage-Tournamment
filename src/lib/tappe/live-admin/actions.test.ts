// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  publishBoardMatches: vi.fn(),
  publishPendingScores: vi.fn(),
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
  publishBoardMatches: mocks.publishBoardMatches,
  publishPendingScores: mocks.publishPendingScores,
}));

const { aggiornaPartita, salvaPunteggio } = await import("./actions");
const { initialAzionePartitaState, LIVE_ADMIN_MESSAGES } =
  await import("./state");
const avvio = await import("@/lib/demo/avvio-fase");

function nuovaTappa(): string {
  const id = avvio.creaDemoAvvioFase("pronta");
  avvio.avviaFaseDemo(id, "M");
  return id;
}

function form(campi: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(campi)) data.set(k, v);
  return data;
}

function partitaId(tappaId: string, girone = 1, turno = 1) {
  return `${tappaId}-M-g${girone}-t${turno}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSupabaseEnv.mockReturnValue(null);
});

describe("aggiornaPartita (demo)", () => {
  it("inizia una partita, aggiorna gli altri admin e la pagina", async () => {
    const id = nuovaTappa();
    const state = await aggiornaPartita(
      initialAzionePartitaState,
      form({
        tappaId: id,
        categoria: "m",
        partitaId: partitaId(id),
        operazione: "inizia",
      }),
    );
    expect(state).toMatchObject({
      status: "success",
      message: "Girone A · turno 1: partita in corso.",
    });
    expect(mocks.refresh).toHaveBeenCalled();
    const board = mocks.publishBoardMatches.mock.calls[0][0];
    expect(board).toMatchObject({
      id: `${id}:M`,
      category: "M",
      change: "Girone A · turno 1: partita in corso",
    });
    expect(
      board.matches.find((p: { id: string }) => p.id === partitaId(id)).stato,
    ).toBe("in_corso");
    expect(mocks.publishPendingScores).toHaveBeenCalledWith(
      expect.objectContaining({ id, count: 1 }),
    );
  });

  it("una partita già iniziata da un altro admin è un conflitto", async () => {
    const id = nuovaTappa();
    const campi = {
      tappaId: id,
      categoria: "m",
      partitaId: partitaId(id),
      operazione: "inizia",
    };
    await aggiornaPartita(initialAzionePartitaState, form(campi));
    const state = await aggiornaPartita(initialAzionePartitaState, form(campi));
    expect(state).toMatchObject({
      status: "error",
      reason: "conflict",
      message: LIVE_ADMIN_MESSAGES.conflict,
    });
  });

  it("non conclude senza una squadra vincente", async () => {
    const id = nuovaTappa();
    const campi = { tappaId: id, categoria: "m", partitaId: partitaId(id) };
    await aggiornaPartita(
      initialAzionePartitaState,
      form({ ...campi, operazione: "inizia" }),
    );
    const state = await aggiornaPartita(
      initialAzionePartitaState,
      form({ ...campi, operazione: "concludi" }),
    );
    expect(state).toMatchObject({
      status: "error",
      message: LIVE_ADMIN_MESSAGES.senzaVincitore,
    });
  });

  it("sessione scaduta con Supabase configurato", async () => {
    mocks.readSupabaseEnv.mockReturnValue({ url: "x", key: "y" });
    mocks.getCurrentUser.mockResolvedValue(null);
    const state = await aggiornaPartita(initialAzionePartitaState, form({}));
    expect(state).toMatchObject({ status: "error", reason: "sessionExpired" });
  });
});

describe("salvaPunteggio (demo)", () => {
  it("salva e conclude con la versione letta", async () => {
    const id = nuovaTappa();
    const campi = { tappaId: id, categoria: "m", partitaId: partitaId(id) };
    await aggiornaPartita(
      initialAzionePartitaState,
      form({ ...campi, operazione: "inizia" }),
    );
    const state = await salvaPunteggio(
      initialAzionePartitaState,
      form({
        ...campi,
        versione: "1",
        set1a: "21",
        set1b: "18",
        set2a: "21",
        set2b: "15",
        concludi: "1",
      }),
    );
    expect(state).toMatchObject({
      status: "success",
      message: "Girone A · turno 1: punteggio 21-18 · 21-15, partita conclusa.",
    });

    // The version read is spent: a stale dialog gets a conflict.
    const vecchia = await salvaPunteggio(
      initialAzionePartitaState,
      form({ ...campi, versione: "1", set1a: "21", set1b: "10" }),
    );
    expect(vecchia).toMatchObject({ status: "error", reason: "conflict" });
  });

  it("errori di campo senza salvare", async () => {
    const id = nuovaTappa();
    const state = await salvaPunteggio(
      initialAzionePartitaState,
      form({
        tappaId: id,
        categoria: "m",
        partitaId: partitaId(id),
        versione: "1",
        set1a: "21",
      }),
    );
    expect(state).toMatchObject({
      status: "fieldErrors",
      errori: { set1: "Set 1: scrivi i punti di entrambe le squadre." },
    });
    expect(mocks.publishBoardMatches).not.toHaveBeenCalled();
  });

  it("«Salva e concludi» con un set pari chiede un vincitore", async () => {
    const id = nuovaTappa();
    const campi = { tappaId: id, categoria: "m", partitaId: partitaId(id) };
    await aggiornaPartita(
      initialAzionePartitaState,
      form({ ...campi, operazione: "inizia" }),
    );
    const state = await salvaPunteggio(
      initialAzionePartitaState,
      form({
        ...campi,
        versione: "1",
        set1a: "21",
        set1b: "18",
        set2a: "15",
        set2b: "21",
        concludi: "1",
      }),
    );
    expect(state).toMatchObject({
      status: "fieldErrors",
      errori: { sets: LIVE_ADMIN_MESSAGES.senzaVincitore },
    });
  });
});
