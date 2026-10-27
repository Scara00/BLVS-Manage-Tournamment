// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveEvent } from "@/lib/live/types";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  readSupabaseEnv: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/env", () => ({
  readSupabaseEnv: mocks.readSupabaseEnv,
}));

const { concludiTabellone } = await import("./actions");
const { initialConcludiTabelloneState } = await import("./state");
const { creaDemoChiusura } = await import("@/lib/demo/chiusura");
const demo = await import("@/lib/demo/admin-live");
const gestione = await import("@/lib/demo/gestione-tappe");
const liveAdmin = await import("@/lib/tappe/live-admin/actions");
const { initialAzionePartitaState } =
  await import("@/lib/tappe/live-admin/state");
const { GET } = await import("@/app/api/live/stream/route");

function form(campi: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(campi)) data.set(k, v);
  return data;
}

const concludi = (tappaId: string, categoria: "m" | "f") =>
  concludiTabellone(
    initialConcludiTabelloneState,
    form({ tappaId, categoria }),
  );

/** Reads SSE frames until an event of `type` arrives. */
async function attendiEvento(
  body: ReadableStream<Uint8Array>,
  type: string,
): Promise<LiveEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("Stream chiuso prima dell'evento atteso");
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const frame: Record<string, string> = {};
        for (const line of raw.split("\n")) {
          const i = line.indexOf(": ");
          if (i > 0) frame[line.slice(0, i)] = line.slice(i + 2);
        }
        if (frame.event === type) return JSON.parse(frame.data!) as LiveEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

const controllers: AbortController[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readSupabaseEnv.mockReturnValue(null);
});

afterEach(() => {
  controllers.splice(0).forEach((c) => c.abort());
});

describe("concludiTabellone (demo)", () => {
  it("chiude i due tabelloni: punti definitivi, tappa conclusa, archiviabile", async () => {
    const id = creaDemoChiusura("finali_concluse");
    expect(demo.classificaTappaDemo(id, "M")?.puntiProvvisori).toBe(true);

    const m = await concludi(id, "m");
    expect(m).toMatchObject({ status: "success", tappaConclusa: false });
    expect(m.status === "success" && m.message).toBe(
      "Tabellone maschile concluso: i punti sono definitivi.",
    );
    expect(mocks.refresh).toHaveBeenCalled();
    const classifica = demo.classificaTappaDemo(id, "M");
    expect(classifica?.puntiProvvisori).toBe(false);
    expect(classifica?.stato).toBe("conclusa");
    expect(gestione.getDemoTappaGestione(id)?.row.stato).toBe("in_corso");

    const f = await concludi(id, "f");
    expect(f).toMatchObject({ status: "success", tappaConclusa: true });
    expect(gestione.getDemoTappaGestione(id)?.row.stato).toBe("conclusa");

    const ancora = await concludi(id, "m");
    expect(ancora).toMatchObject({
      status: "error",
      reason: "bloccato",
      message: "Il tabellone è già concluso.",
    });
  });

  it("rifiuta con una partita non conclusa", async () => {
    const id = creaDemoChiusura("partita_aperta");
    const state = await concludi(id, "m");
    expect(state).toMatchObject({
      status: "error",
      reason: "bloccato",
      message:
        "Non si può concludere: 1 partita non è conclusa con una squadra vincente.",
    });
    expect(demo.getDemoConclusoIl(id, "M")).toBeNull();
  });

  it("rifiuta con una parità da risolvere e porta a risolverla", async () => {
    const id = creaDemoChiusura("parita");
    const state = await concludi(id, "m");
    expect(state).toMatchObject({
      status: "error",
      reason: "bloccato",
      link: {
        label: "Risolvi parità",
        href: `/admin/tappe/${id}/live/m#girone-live-${id}-M-finale_gold`,
      },
    });
  });

  it("l'evento di chiusura arriva sul canale live entro 5 s", async () => {
    const id = creaDemoChiusura("finali_concluse");
    const controller = new AbortController();
    controllers.push(controller);
    const res = await GET(
      new Request("http://localhost/api/live/stream", {
        signal: controller.signal,
      }),
    );
    const arrivato = attendiEvento(res.body!, "board-closed");

    const inizio = performance.now();
    await concludi(id, "m");
    const evento = await arrivato;
    expect(performance.now() - inizio).toBeLessThan(5_000);
    expect(evento.type).toBe("board-closed");
    if (evento.type !== "board-closed") return;
    expect(evento.board).toMatchObject({
      id: `${id}:M`,
      stageId: id,
      category: "M",
      stageConcluded: false,
    });
    expect(evento.board.points.map((p) => p.points)).toEqual([
      12, 8, 4, 2, 8, 6, 2, 1,
    ]);
  });
});

describe("correzione su tabellone concluso (demo)", () => {
  it("chiede conferma elencando i punti che cambiano, poi salva", async () => {
    const id = creaDemoChiusura("finali_concluse");
    await concludi(id, "m");
    const partita = demo
      .getDemoTabelloneLive(id, "M", new Date())!
      .partite.find((p) => p.id === `${id}-M-finale_gold-t1`)!;
    const campi = {
      tappaId: id,
      categoria: "m",
      partitaId: partita.id,
      versione: String(partita.versione),
      set1a: "10",
      set1b: "21",
    };

    const richiesta = await liveAdmin.salvaPunteggio(
      initialAzionePartitaState,
      form(campi),
    );
    expect(richiesta.status).toBe("confermaConcluso");
    if (richiesta.status !== "confermaConcluso") return;
    expect(richiesta.cambi.length).toBeGreaterThan(0);
    // Nothing saved yet.
    expect(
      demo
        .getDemoTabelloneLive(id, "M", new Date())!
        .partite.find((p) => p.id === partita.id)!.sets,
    ).toEqual(partita.sets);

    const salvata = await liveAdmin.salvaPunteggio(
      richiesta,
      form({ ...campi, conferma: "1", firma: richiesta.firma }),
    );
    expect(salvata).toMatchObject({ status: "success" });
    const dopo = demo.getDemoTabelloneLive(id, "M", new Date())!;
    expect(dopo.conclusoIl).not.toBeNull();
    expect(dopo.partite.find((p) => p.id === partita.id)!.sets).toEqual([
      { a: 10, b: 21 },
    ]);
    expect(demo.classificaTappaDemo(id, "M")?.puntiProvvisori).toBe(false);
  });

  it("con una firma vecchia chiede di nuovo la conferma", async () => {
    const id = creaDemoChiusura("finali_concluse");
    await concludi(id, "m");
    const partita = demo
      .getDemoTabelloneLive(id, "M", new Date())!
      .partite.find((p) => p.id === `${id}-M-finale_gold-t1`)!;
    const state = await liveAdmin.salvaPunteggio(
      initialAzionePartitaState,
      form({
        tappaId: id,
        categoria: "m",
        partitaId: partita.id,
        versione: String(partita.versione),
        set1a: "10",
        set1b: "21",
        conferma: "1",
        firma: "vecchia",
      }),
    );
    expect(state).toMatchObject({
      status: "confermaConcluso",
      avviso:
        "I punti sono cambiati nel frattempo: controlla di nuovo cosa cambia prima di confermare.",
    });
  });
});
