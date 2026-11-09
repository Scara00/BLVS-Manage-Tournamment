// @vitest-environment node
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { impostaProvaDemo } from "@/lib/demo/gestione-tappe";
import { controllaTappa, tappaDaPercorso, tappaVisibile } from "./visibile";

describe("tappaDaPercorso", () => {
  it.each([
    ["/tappe/rimini", "rimini"],
    ["/tappe/rimini/", "rimini"],
    ["/tappe/rimini/iscrizione", "rimini"],
    ["/tappe/jesolo/live", "jesolo"],
    ["/tappe/jesolo/tabellone", "jesolo"],
    ["/tappe/jesolo/gironi/g-1", "jesolo"],
    ["/tappe/jesolo/gironi", null],
    ["/tappe/jesolo/classifica", "jesolo"],
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

describe("controllaTappa (tappa di prova)", () => {
  const ID = "5f7c1f8e-1d2b-4c3a-9e8f-0a1b2c3d4e5f";
  const pagina = (path: string, cookie?: string) =>
    new NextRequest(`http://example.com${path}`, {
      headers: cookie ? { cookie } : {},
    });

  afterEach(() => {
    impostaProvaDemo("bari", false);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("demo: una bozza è un 404, la stessa bozza di prova si apre", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const prima = await controllaTappa(pagina("/tappe/bari/tabellone"));
    expect(prima.esito).toBe("nonTrovata");
    impostaProvaDemo("bari", true);
    expect(await tappaVisibile("bari")).toBe(true);
    expect((await controllaTappa(pagina("/tappe/bari/live"))).esito).toBe(
      "prosegui",
    );
  });

  describe("con Supabase", () => {
    function senzaTappaPubblica() {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
      // The anonymous client sees no draft: an empty result.
      return vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async () =>
          Response.json([], { headers: { "content-range": "*/0" } }),
        );
    }

    it("senza sessione: 404 subito, senza passare dalla sessione", async () => {
      senzaTappaPubblica();
      const esito = await controllaTappa(pagina(`/tappe/${ID}`));
      expect(esito.esito).toBe("nonTrovata");
      if (esito.esito !== "nonTrovata") return;
      expect(esito.risposta.headers.get("x-middleware-rewrite")).toBe(
        "http://example.com/_tappa-non-trovata",
      );
    });

    it("con una sessione decide con la sessione: solo chi vede la bozza di prova passa", async () => {
      senzaTappaPubblica();
      const esito = await controllaTappa(
        pagina(`/tappe/${ID}/classifica`, "sb-x-auth-token=abc"),
      );
      expect(esito.esito).toBe("conSessione");
      if (esito.esito !== "conSessione") return;

      const supabaseCon = (riga: unknown) =>
        ({
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: riga, error: null }),
              }),
            }),
          }),
        }) as unknown as SupabaseClient;

      // Admin: RLS shows the test draft.
      expect(
        await esito.controllaPagina(
          supabaseCon({ stato: "bozza", prova: true }),
          true,
        ),
      ).toBeNull();
      // Player: RLS hides the draft, so nothing comes back.
      const giocatore = await esito.controllaPagina(supabaseCon(null), true);
      expect(giocatore?.headers.get("x-middleware-rewrite")).toBe(
        "http://example.com/_tappa-non-trovata",
      );
      // A draft that is not a test stage stays hidden even for the admin.
      expect(
        await esito.controllaPagina(
          supabaseCon({ stato: "bozza", prova: false }),
          true,
        ),
      ).not.toBeNull();
      // An expired session: 404 without asking the database.
      expect(
        await esito.controllaPagina(
          supabaseCon({ stato: "bozza", prova: true }),
          false,
        ),
      ).not.toBeNull();
    });
  });
});
