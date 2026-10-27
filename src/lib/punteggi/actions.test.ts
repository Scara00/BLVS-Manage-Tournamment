// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  publishScore: vi.fn(),
  publishGroupStandings: vi.fn(),
  publishPendingScores: vi.fn(),
  rpc: vi.fn(),
  leggiPunteggi: vi.fn(),
  leggiClassificaGirone: vi.fn(),
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
  publishScore: mocks.publishScore,
  publishGroupStandings: mocks.publishGroupStandings,
  publishPendingScores: mocks.publishPendingScores,
}));
vi.mock("./dati", () => ({ leggiPunteggi: mocks.leggiPunteggi }));
vi.mock("@/lib/gironi/classifica", async (original) => ({
  ...(await original<typeof import("@/lib/gironi/classifica")>()),
  leggiClassificaGirone: mocks.leggiClassificaGirone,
}));

const { annullaPunteggio, salvaPunteggio } = await import("./actions");
const { initialPunteggioState, PUNTEGGIO_MESSAGES } = await import("./state");
const { messaggioRegolaSet } = await import("./validazione");
const demo = await import("@/lib/demo/punteggi");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("senza Supabase (demo)", () => {
  let tappa: string;
  let partitaId: string;

  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue(null);
    tappa = demo.creaDemoPunteggi();
    partitaId = demo.getDemoPunteggi(tappa)!.partite[0].id;
  });

  function salva(a: string, b: string, versione = "1") {
    return salvaPunteggio(
      initialPunteggioState,
      form({ tappaId: tappa, partitaId, versione, puntiA: a, puntiB: b }),
    );
  }

  it("salva, pubblica punteggio, classifica e conteggio, e ricarica", async () => {
    const state = await salva("21", "17");
    expect(state).toMatchObject({
      status: "success",
      partitaId,
      versione: 2,
      punteggio: { a: 21, b: 17 },
      tipo: "inserimento",
      message: PUNTEGGIO_MESSAGES.salvato,
    });
    expect(mocks.publishScore).toHaveBeenCalledWith(
      expect.objectContaining({ id: partitaId, sets: [[21, 17]] }),
    );
    const classifica = mocks.publishGroupStandings.mock.calls[0][0];
    expect(classifica.rows).toHaveLength(4);
    expect(
      classifica.rows.filter((r: { won: number }) => r.won === 1),
    ).toHaveLength(2);
    expect(mocks.publishPendingScores).toHaveBeenCalledWith(
      expect.objectContaining({ id: tappa, count: 5 }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("rifiuta i valori non validi come il form, senza salvare", async () => {
    const state = await salva("21", "20");
    expect(state).toMatchObject({
      status: "fieldErrors",
      punteggio: messaggioRegolaSet(21, 20),
    });
    const vuoto = await salva("", "1.5");
    expect(vuoto).toMatchObject({
      status: "fieldErrors",
      campi: { a: expect.any(String), b: expect.any(String) },
    });
    expect(mocks.publishScore).not.toHaveBeenCalled();
    expect(demo.getDemoPunteggi(tappa)!.partite[0].versione).toBe(1);
  });

  it("una versione superata è un conflitto", async () => {
    await salva("21", "17");
    expect(await salva("21", "15")).toMatchObject({
      status: "error",
      reason: "conflict",
    });
  });

  it("annulla, ripubblica e la classifica torna come prima", async () => {
    await salva("21", "17");
    vi.clearAllMocks();
    const esito = await annullaPunteggio({
      tappaId: tappa,
      partitaId,
      versione: 2,
    });
    expect(esito).toEqual({
      status: "success",
      message: PUNTEGGIO_MESSAGES.annullato,
    });
    expect(mocks.publishScore).toHaveBeenCalledWith(
      expect.objectContaining({ id: partitaId, sets: [] }),
    );
    const classifica = mocks.publishGroupStandings.mock.calls[0][0];
    expect(
      classifica.rows.every((r: { played: number }) => r.played === 0),
    ).toBe(true);
    expect(mocks.publishPendingScores).toHaveBeenCalledWith(
      expect.objectContaining({ count: 6 }),
    );
  });

  it("un secondo annullamento è rifiutato", async () => {
    await salva("21", "17");
    await annullaPunteggio({ tappaId: tappa, partitaId, versione: 2 });
    expect(
      await annullaPunteggio({ tappaId: tappa, partitaId, versione: 3 }),
    ).toMatchObject({ status: "error", reason: "conflict" });
  });
});

describe("con il database", () => {
  const PARTITA = "00000000-0000-4000-8000-000000003201";
  const supabase = { rpc: (...args: unknown[]) => mocks.rpc(...args) };

  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue({ url: "x", key: "y" });
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "admin", supabase });
    mocks.leggiPunteggi.mockResolvedValue(null);
  });

  function salva() {
    return salvaPunteggio(
      initialPunteggioState,
      form({
        tappaId: "t",
        partitaId: PARTITA,
        versione: "4",
        puntiA: "23",
        puntiB: "21",
      }),
    );
  }

  it("chiama salva_punteggio con la versione letta", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ versione: 5, tipo: "correzione_punteggio" }],
      error: null,
    });
    expect(await salva()).toMatchObject({
      status: "success",
      versione: 5,
      tipo: "correzione",
      message: PUNTEGGIO_MESSAGES.corretto,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("salva_punteggio", {
      p_partita: PARTITA,
      p_versione: 4,
      p_a: 23,
      p_b: 21,
    });
  });

  it.each([
    [{ code: "40001", hint: "versione_superata" }, "conflict"],
    [{ code: "23514", hint: "partita_non_giocabile" }, "nonGiocabile"],
    [{ code: "23514", hint: "tappa_archiviata" }, "nonGiocabile"],
    [{ code: "42501" }, "permissionDenied"],
    [{ code: "XX000", message: "boom" }, "network"],
  ])("traduce l'errore %o in %s", async (error, reason) => {
    mocks.rpc.mockResolvedValue({ data: null, error });
    expect(await salva()).toMatchObject({ status: "error", reason });
  });

  it("un rifiuto della regola dal server torna sui campi", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "regola_set" },
    });
    expect(await salva()).toMatchObject({ status: "fieldErrors" });
  });

  it("annulla_punteggio: finestra scaduta", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", hint: "annullamento_scaduto" },
    });
    expect(
      await annullaPunteggio({ tappaId: "t", partitaId: PARTITA, versione: 5 }),
    ).toEqual({
      status: "error",
      reason: "annullamentoScaduto",
      message: PUNTEGGIO_MESSAGES.annullamentoScaduto,
    });
  });

  it("sessione scaduta e giocatore", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await salva()).toMatchObject({ reason: "sessionExpired" });
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "giocatore", supabase });
    expect(await salva()).toMatchObject({ reason: "permissionDenied" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
