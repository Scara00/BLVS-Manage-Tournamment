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
});
