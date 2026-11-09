// @vitest-environment node
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn();
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const { proxy, config } = await import("./proxy");

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    updateSession.mockReset();
  });

  it("reindirizza su HTTPS prima di rinnovare la sessione", async () => {
    vi.stubEnv("ENFORCE_HTTPS", "true");
    const res = await proxy(new NextRequest("http://example.com/"));
    expect(res.status).toBe(308);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("in HTTPS rinnova la sessione", async () => {
    vi.stubEnv("ENFORCE_HTTPS", "true");
    updateSession.mockResolvedValue("ok");
    const res = await proxy(new NextRequest("https://example.com/"));
    expect(res).toBe("ok");
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it("tappa in bozza o inesistente: riscrive su una pagina 404 prima del rendering", async () => {
    for (const path of ["/tappe/lignano", "/tappe/nessuna/iscrizione"]) {
      const res = await proxy(new NextRequest(`http://example.com${path}`));
      expect(res.headers.get("x-middleware-rewrite")).toBe(
        "http://example.com/_tappa-non-trovata",
      );
    }
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("con Supabase e una sessione, una tappa nascosta al pubblico si decide con la sessione (tappa di prova)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => Response.json([]));
    updateSession.mockResolvedValue("ok");
    const id = "5f7c1f8e-1d2b-4c3a-9e8f-0a1b2c3d4e5f";

    const res = await proxy(
      new NextRequest(`http://example.com/tappe/${id}/tabellone`, {
        headers: { cookie: "sb-x-auth-token=abc" },
      }),
    );
    expect(res).toBe("ok");
    expect(updateSession).toHaveBeenCalledWith(expect.any(NextRequest), {
      controllaPagina: expect.any(Function),
    });

    // Without a session the same page is a 404 at once.
    const anonimo = await proxy(
      new NextRequest(`http://example.com/tappe/${id}/tabellone`),
    );
    expect(anonimo.headers.get("x-middleware-rewrite")).toBe(
      "http://example.com/_tappa-non-trovata",
    );
    expect(updateSession).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });

  it("girone demo inesistente: riscrive su una pagina 404 prima del rendering", async () => {
    for (const path of ["/gironi/zz", "/gironi/%E0%A4%A"]) {
      const res = await proxy(new NextRequest(`http://example.com${path}`));
      expect(res.headers.get("x-middleware-rewrite")).toBe(
        "http://example.com/_tappa-non-trovata",
      );
    }
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("girone demo esistente: prosegue con la sessione", async () => {
    updateSession.mockResolvedValue("ok");
    expect(await proxy(new NextRequest("http://example.com/gironi/a"))).toBe(
      "ok",
    );
    expect(updateSession).toHaveBeenCalledOnce();
  });

  it("con Supabase /gironi/<id> non esiste: sempre 404", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "chiave");
    const res = await proxy(new NextRequest("http://example.com/gironi/a"));
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://example.com/_tappa-non-trovata",
    );
  });

  it("tappa visibile, o una POST (server action): prosegue con la sessione", async () => {
    updateSession.mockResolvedValue("ok");
    expect(
      await proxy(new NextRequest("http://example.com/tappe/rimini")),
    ).toBe("ok");
    expect(
      await proxy(
        new NextRequest("http://example.com/tappe/lignano", { method: "POST" }),
      ),
    ).toBe("ok");
    expect(updateSession).toHaveBeenCalledTimes(2);
  });

  it("lascia passare senza sessione le icone e il manifest della home del telefono", () => {
    const passa = (path: string) =>
      unstable_doesMiddlewareMatch({
        config,
        url: `https://example.com${path}`,
      });
    for (const path of [
      "/favicon.ico",
      "/apple-icon.png",
      "/icon-512.png",
      "/manifest.webmanifest",
    ])
      expect(passa(path), path).toBe(false);
    expect(passa("/")).toBe(true);
  });
});
