// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/env", () => ({ readSupabaseEnv: () => null }));
vi.mock("next/server", () => ({ connection: async () => {} }));

const { creaDemoChiusura } = await import("@/lib/demo/chiusura");
const { concludiTabelloneDemo, impostaRisultatoLiveDemo } =
  await import("@/lib/demo/admin-live");
const { getLiveBus } = await import("@/lib/live/bus");
const { pubblicaClassificaTappa } = await import("./pubblica");
const { readClassificaTappaSync, readVistaClassificaTappa } =
  await import("./read");

/** The stage-standings events published since `from`. */
function pubblicati(id: string, from: number) {
  const eventi: { change?: string | null; provisional: boolean }[] = [];
  const stop = getLiveBus().subscribe((event) => {
    if (event.seq > from && event.type === "stage-standings") {
      if (event.standings.id === id) eventi.push(event.standings);
    }
  });
  return { eventi, stop };
}

describe("pubblicaClassificaTappa (demo)", () => {
  let id: string;
  beforeEach(() => {
    id = creaDemoChiusura("partita_aperta");
  });

  it("pubblica una volta, poi solo quando cambia qualcosa, dicendo cosa", async () => {
    const seq = getLiveBus().snapshot().seq;
    const { eventi, stop } = pubblicati(`${id}:M`, seq);

    await pubblicaClassificaTappa(id, "M");
    await pubblicaClassificaTappa(id, "M");
    expect(eventi).toHaveLength(1);
    expect(eventi[0].change).toBeNull();

    // The admin enters the last silver match: its places become final.
    impostaRisultatoLiveDemo(id, "M", `${id}-M-finale_silver-t3`, [
      { a: 21, b: 14 },
    ]);
    await pubblicaClassificaTappa(id, "M");
    expect(eventi).toHaveLength(2);
    expect(eventi[1].change).toBe("4 posizioni definitive");
    expect(eventi[1].provisional).toBe(true);

    concludiTabelloneDemo(id, "M", new Date());
    await pubblicaClassificaTappa(id, "M");
    expect(eventi[2]).toMatchObject({
      change: "punti definitivi",
      provisional: false,
    });
    stop();
  });

  it("la vista del giocatore demo: categoria del suo tabellone, riga in finale gold", async () => {
    const vista = await readVistaClassificaTappa(id, undefined);
    expect(vista.status).toBe("ok");
    if (vista.status !== "ok") return;
    expect(vista).toMatchObject({
      categoria: "M",
      me: `${id}-M-i1`,
      meCategoria: "M",
      standingsId: `${id}:M`,
    });
    const standings = vista.sync.snapshot.stageStandings?.[0];
    expect(standings?.rows.find((r) => r.playerId === vista.me)).toMatchObject({
      phase: "gold",
      position: 1,
      points: 12,
    });
    const femminile = await readVistaClassificaTappa(id, "f");
    expect(femminile).toMatchObject({ categoria: "F", meCategoria: "M" });
  });

  it("tappa sconosciuta: notFound; sync vuota", async () => {
    expect(await readVistaClassificaTappa("nessuna", "M")).toEqual({
      status: "notFound",
    });
    const sync = await readClassificaTappaSync("nessuna", "M");
    expect(sync.snapshot.stageStandings).toEqual([]);
  });
});
