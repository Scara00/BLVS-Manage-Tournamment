// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  publishGroupStandings: vi.fn(),
  risolviParitaGirone: vi.fn(),
  leggiDatiParitaTabellone: vi.fn(),
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
  publishGroupStandings: mocks.publishGroupStandings,
}));
vi.mock("./dati", () => ({
  leggiDatiParitaTabellone: mocks.leggiDatiParitaTabellone,
}));
vi.mock("@/lib/gironi/classifica", async (original) => ({
  ...(await original<typeof import("@/lib/gironi/classifica")>()),
  risolviParitaGirone: mocks.risolviParitaGirone,
}));

const { risolviParita } = await import("./actions");
const { initialRisolviParitaState, PARITA_MESSAGES: M } =
  await import("./types");
const { paritaGirone } = await import("./format");
const demo = await import("@/lib/demo/parita");
const { demoRegistroTappa } = await import("@/lib/demo/registro");

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const v of [value].flat()) data.append(key, v);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("senza Supabase (demo)", () => {
  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue(null);
  });

  function paritaDemo() {
    const { id, categoria, gironeId } = demo.creaDemoParita();
    const girone = demo
      .getDemoDatiParita(id, categoria)!
      .find((g) => g.gironeId === gironeId)!;
    return { id, gironeId, parita: paritaGirone(girone).parita[0] };
  }

  it("applica l'ordine, scrive la voce di registro con l'autore e lo annuncia", async () => {
    const { id, gironeId, parita } = paritaDemo();
    expect(parita.posizione).toBe(2);
    const [b, c, d] = parita.giocatori;

    const state = await risolviParita(
      initialRisolviParitaState,
      form({
        tappaId: id,
        categoria: "M",
        gironeId,
        firma: parita.firma,
        ordine: [d.iscrizioneId, b.iscrizioneId, c.iscrizioneId],
        motivo: "sorteggio",
        note: "monetina al campo 1",
      }),
    );

    expect(state).toMatchObject({
      status: "success",
      firma: parita.firma,
      message: `Girone A: ordine deciso. 2º ${d.nome}, 3º ${b.nome}, 4º ${c.nome}.`,
    });
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.publishGroupStandings).toHaveBeenCalledWith(
      expect.objectContaining({
        id: gironeId,
        stageId: id,
        category: "M",
        rows: expect.arrayContaining([
          expect.objectContaining({ playerId: d.iscrizioneId, position: 2 }),
        ]),
      }),
    );

    const decisa = paritaGirone(
      demo.getDemoDatiParita(id, "M")!.find((g) => g.gironeId === gironeId)!,
    ).parita[0];
    expect(decisa.decisione).toEqual({
      motivo: "Sorteggio: monetina al campo 1",
    });

    const registro = demoRegistroTappa(
      id,
      { tipo: null, partita: null },
      null,
      30,
    )!;
    expect(registro.rows).toHaveLength(1);
    expect(registro.rows[0]).toMatchObject({
      tipo: "parita_risolta",
      autore: demo.AUTORE_DEMO,
      valore_prima: null,
      valore_dopo: {
        girone: "Girone A",
        firma: parita.firma,
        ordine: [d.nome, b.nome, c.nome],
      },
      nota: "Sorteggio: monetina al campo 1",
    });
  });

  it("una seconda decisione sostituisce la prima e il registro tiene la precedente", async () => {
    const { id, gironeId, parita } = paritaDemo();
    const ids = parita.giocatori.map((g) => g.iscrizioneId);
    const base = {
      tappaId: id,
      categoria: "M",
      gironeId,
      firma: parita.firma,
    };
    await risolviParita(
      initialRisolviParitaState,
      form({ ...base, ordine: ids, motivo: "accordo" }),
    );
    const state = await risolviParita(
      initialRisolviParitaState,
      form({
        ...base,
        ordine: [...ids].reverse(),
        motivo: "altro",
        note: "Decide il giudice",
      }),
    );
    expect(state.status).toBe("success");
    const [ultima] = demoRegistroTappa(
      id,
      { tipo: null, partita: null },
      null,
      30,
    )!.rows;
    expect(ultima.valore_prima).toEqual({
      ordine: parita.giocatori.map((g) => g.nome),
      motivo: "Accordo tra i giocatori",
    });
    expect(ultima.nota).toBe("Decide il giudice");
  });

  it("rifiuta un motivo mancante, un ordine non valido e una parità che non c'è più", async () => {
    const { id, gironeId, parita } = paritaDemo();
    const ids = parita.giocatori.map((g) => g.iscrizioneId);
    const base = { tappaId: id, categoria: "M", gironeId, firma: parita.firma };

    expect(
      await risolviParita(
        initialRisolviParitaState,
        form({ ...base, ordine: ids }),
      ),
    ).toMatchObject({
      status: "fieldErrors",
      fields: { motivo: M.motivoMancante },
    });
    expect(
      await risolviParita(
        initialRisolviParitaState,
        form({ ...base, ordine: ids.slice(0, 2), motivo: "sorteggio" }),
      ),
    ).toMatchObject({
      status: "fieldErrors",
      fields: { ordine: M.ordineNonValido },
    });
    expect(
      await risolviParita(
        initialRisolviParitaState,
        form({
          ...base,
          firma: "x:1/1/1/1|y:1/1/1/1",
          ordine: ids,
          motivo: "sorteggio",
        }),
      ),
    ).toMatchObject({ status: "error", reason: "conflict" });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

describe("con Supabase", () => {
  const G = "00000000-0000-4000-8000-000000000001";
  const T = "00000000-0000-4000-8000-000000000002";
  const A = "00000000-0000-4000-8000-00000000000a";
  const B = "00000000-0000-4000-8000-00000000000b";
  const base = {
    tappaId: T,
    categoria: "M",
    gironeId: G,
    firma: `${A}:1/1/21/0|${B}:1/1/21/0`,
    ordine: [B, A],
    motivo: "sorteggio",
  };

  beforeEach(() => {
    mocks.readSupabaseEnv.mockReturnValue({});
    mocks.getCurrentUser.mockResolvedValue({ ruolo: "admin", supabase: {} });
    mocks.leggiDatiParitaTabellone.mockResolvedValue([]);
  });

  it("salva con il motivo composto e aggiorna la pagina", async () => {
    mocks.risolviParitaGirone.mockResolvedValue({ ok: true, classifica: {} });
    const state = await risolviParita(initialRisolviParitaState, form(base));
    expect(mocks.risolviParitaGirone).toHaveBeenCalledWith(
      {},
      { gironeId: G, firma: base.firma, ordine: [B, A], motivo: "Sorteggio" },
    );
    expect(state.status).toBe("success");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it.each([
    [
      { ok: false, reason: "conflict", message: "cambiata" },
      { status: "error", reason: "conflict", message: "cambiata" },
    ],
    [
      { ok: false, reason: "permissionDenied", message: "x" },
      {
        status: "error",
        reason: "permissionDenied",
        message: M.permissionDenied,
      },
    ],
    [
      { ok: false, reason: "network", message: "x" },
      { status: "error", reason: "network", message: M.network },
    ],
  ])("traduce l'esito %o", async (esito, atteso) => {
    mocks.risolviParitaGirone.mockResolvedValue(esito);
    expect(
      await risolviParita(initialRisolviParitaState, form(base)),
    ).toMatchObject(atteso);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("senza sessione o senza ruolo admin non chiama il database", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    expect(
      await risolviParita(initialRisolviParitaState, form(base)),
    ).toMatchObject({
      reason: "sessionExpired",
    });
    mocks.getCurrentUser.mockResolvedValueOnce({
      ruolo: "giocatore",
      supabase: {},
    });
    expect(
      await risolviParita(initialRisolviParitaState, form(base)),
    ).toMatchObject({
      reason: "permissionDenied",
    });
    expect(mocks.risolviParitaGirone).not.toHaveBeenCalled();
  });
});
