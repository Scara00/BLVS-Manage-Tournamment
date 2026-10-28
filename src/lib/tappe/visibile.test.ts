// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { tappaDaPercorso, tappaVisibile } from "./visibile";

describe("tappaDaPercorso", () => {
  it.each([
    ["/tappe/rimini", "rimini"],
    ["/tappe/rimini/", "rimini"],
    ["/tappe/rimini/iscrizione", "rimini"],
    ["/tappe/jesolo/live", "jesolo"],
    ["/tappe/jesolo/gironi/g-1", "jesolo"],
    ["/tappe/jesolo/gironi", null],
    ["/tappe/a%20b", "a b"],
    ["/tappe", null],
    ["/tappe/rimini/altro", null],
    ["/admin/tappe/rimini", null],
  ])("%s → %s", (path, id) => {
    expect(tappaDaPercorso(path)).toBe(id);
  });
});

describe("tappaVisibile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("demo: le bozze e gli id sconosciuti non sono visibili", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await tappaVisibile("rimini")).toBe(true);
    expect(await tappaVisibile("lignano")).toBe(false);
    expect(await tappaVisibile("inesistente")).toBe(false);
  });

  it("con Supabase un id che non è un UUID non arriva al database", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await tappaVisibile("rimini")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
