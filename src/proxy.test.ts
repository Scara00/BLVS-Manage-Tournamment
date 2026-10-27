// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateSession = vi.fn();
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));

const { proxy } = await import("./proxy");

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
});
