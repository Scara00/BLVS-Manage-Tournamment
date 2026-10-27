// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
  publishScore: vi.fn(),
  publishGroupStandings: vi.fn(),
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
  publishScore: mocks.publishScore,
  publishGroupStandings: mocks.publishGroupStandings,
  publishPendingScores: mocks.publishPendingScores,
}));

const { salvaParziale, salvaPunteggio } = await import("./actions");
const { initialPunteggioState } = await import("./state");
const {
  accettaParziale,
  initialParzialeState,
  PARZIALE_MESSAGES,
  validaParziale,
} = await import("./parziale");
const { conParziali } = await import("./dati");
const { toLiveMatch } = await import("./format");
const demo = await import("@/lib/demo/punteggi");
const { announcementFor } = await import("@/lib/live/announce");
const { annuncioPartita } = await import("@/lib/live/tappa");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSupabaseEnv.mockReturnValue(null);
});

describe("validaParziale", () => {
  it("interi da 0 a 99, pareggio ammesso, nessuna regola del set", () => {
    expect(validaParziale({ a: "7", b: "7" }).valido).toBe(true);
    expect(validaParziale({ a: "0", b: "14" }).valido).toBe(true);
    expect(validaParziale({ a: "1.5", b: "-1" })).toMatchObject({
      valido: false,
      campi: { a: expect.any(String), b: expect.any(String) },
    });
    expect(validaParziale({ a: "100", b: "3" }).valido).toBe(false);
    expect(
      validaParziale({ a: "", b: "3" }, { completo: false }),
    ).toMatchObject({ valido: false, campi: {} });
  });

  it("solo per una partita in corso di una tappa in corso", () => {
    expect(accettaParziale({ stato: "in_corso" }, "in_corso")).toBe(true);
    expect(accettaParziale({ stato: "programmata" }, "in_corso")).toBe(false);
    expect(accettaParziale({ stato: "in_corso" }, "archiviata")).toBe(false);
  });
});

describe("salvaParziale (demo)", () => {
  let tappa: string;
  let partitaId: string;

  beforeEach(() => {
    ({ id: tappa, partitaId } = demo.creaDemoPartitaInCorso());
  });

  function invia(a: string, b: string, versione = "0", extra = {}) {
    return salvaParziale(
      initialParzialeState,
      form({
        tappaId: tappa,
        partitaId,
        versione,
        puntiA: a,
        puntiB: b,
        ...extra,
      }),
    );
  }

  it("salva e pubblica solo la partita, con il parziale e senza set", async () => {
    expect(await invia("14", "11")).toMatchObject({
      status: "success",
      versione: 1,
      punti: { a: 14, b: 11 },
      message: PARZIALE_MESSAGES.inviato,
    });
    expect(mocks.publishScore).toHaveBeenCalledWith(
      expect.objectContaining({
        id: partitaId,
        stageId: tappa,
        state: "in_corso",
        sets: [],
        partial: expect.objectContaining({ home: 14, away: 11 }),
      }),
    );
    // A partial changes no standing and no count of results to enter.
    expect(mocks.publishGroupStandings).not.toHaveBeenCalled();
    expect(mocks.publishPendingScores).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("non entra in classifica né nel punteggio ufficiale", async () => {
    const partita = demo.getDemoPunteggi(tappa)!.partite[0];
    const prima = demo.classificaDemo(tappa, partita.gironeId);
    await invia("20", "3");
    const dopo = demo.getDemoPunteggi(tappa)!.partite[0];
    expect(dopo).toMatchObject({ stato: "in_corso", sets: [], versione: 1 });
    expect(dopo.parziale).toMatchObject({ a: 20, b: 3, versione: 1 });
    expect(demo.classificaDemo(tappa, partita.gironeId)).toEqual(prima);
    expect(
      demo
        .classificaDemo(tappa, partita.gironeId)!
        .righe.every((r) => r.giocate === 0),
    ).toBe(true);
  });

  it("un altro admin ha inviato prima: conflitto con il parziale attuale", async () => {
    await invia("3", "2");
    vi.clearAllMocks();
    expect(await invia("9", "9")).toMatchObject({
      status: "conflict",
      salvato: { versione: 1, sets: [{ a: 3, b: 2 }] },
      mio: { a: 9, b: 9 },
    });
    expect(mocks.publishScore).not.toHaveBeenCalled();
    // «Sovrascrivi» over the version shown in the dialog.
    expect(await invia("9", "9", "1", { sovrascrivi: "1" })).toMatchObject({
      status: "success",
      versione: 2,
    });
  });

  it("rifiuta valori non validi e partite non in corso", async () => {
    expect(await invia("1.5", "3")).toMatchObject({ status: "fieldErrors" });
    const altra = demo.getDemoPunteggi(tappa)!.partite[1].id;
    expect(
      await salvaParziale(
        initialParzialeState,
        form({
          tappaId: tappa,
          partitaId: altra,
          versione: "0",
          puntiA: "1",
          puntiB: "0",
        }),
      ),
    ).toMatchObject({ status: "error", reason: "nonInCorso" });
  });

  it("il risultato ufficiale cancella il parziale", async () => {
    await invia("19", "18");
    await salvaPunteggio(
      initialPunteggioState,
      form({
        tappaId: tappa,
        partitaId,
        versione: "1",
        puntiA: "21",
        puntiB: "18",
      }),
    );
    const partita = demo.getDemoPunteggi(tappa)!.partite[0];
    expect(partita).toMatchObject({ stato: "conclusa", parziale: null });
    expect(toLiveMatch(partita, tappa).partial).toBeNull();
  });
});

describe("conParziali", () => {
  it("mette il parziale solo sulle partite in corso", () => {
    const base = demo.getDemoPunteggi(demo.creaDemoPunteggi())!.partite;
    const [a, b] = base;
    const righe = [a, b].map((p) => ({
      partita_id: p.id,
      a: 1,
      b: 2,
      versione: 3,
      aggiornato_il: "2027-06-12T08:00:00.000Z",
    }));
    const out = conParziali([{ ...a, stato: "in_corso" }, b], righe);
    expect(out[0].parziale).toEqual({
      a: 1,
      b: 2,
      versione: 3,
      aggiornatoIl: "2027-06-12T08:00:00.000Z",
    });
    expect(out[1].parziale).toBeNull();
  });
});

describe("annunci del parziale", () => {
  const event = (home: number, away: number) => {
    const { id, partitaId } = demo.creaDemoPartitaInCorso();
    demo.salvaParzialeDemo(id, partitaId, 0, { a: home, b: away }, 0);
    const partita = demo
      .getDemoPunteggi(id)!
      .partite.find((p) => p.id === partitaId)!;
    return {
      me: `${id}-M-i1`,
      ev: {
        type: "score" as const,
        match: toLiveMatch(partita, id),
        seq: 1,
        savedAt: "2027-06-12T08:00:00.000Z",
      },
    };
  };

  it("frase breve, dal lato del giocatore sul suo live", () => {
    const { ev, me } = event(14, 11);
    expect(announcementFor(ev)).toBe("Girone A: parziale 14-11");
    const lato = ev.match.players!.home.some((p) => p.id === me)
      ? "14-11"
      : "11-14";
    expect(annuncioPartita(ev, me)).toBe(`La tua partita, parziale: ${lato}`);
    expect(annuncioPartita(ev, null)).toBe("Girone A: parziale 14-11");
  });
});
