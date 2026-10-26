// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const createServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({ createServerClient }));

async function loadUpdateSession() {
  vi.resetModules();
  return (await import("./proxy")).updateSession;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    getClaims.mockReset();
    createServerClient.mockReset();
  });

  it("senza env Supabase lascia passare la richiesta e avvisa una sola volta", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const updateSession = await loadUpdateSession();

    const res = await updateSession(new NextRequest("http://localhost/"));
    await updateSession(new NextRequest("http://localhost/"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("propaga sulla risposta i cookie e gli header ruotati da Supabase", async () => {
    createServerClient.mockImplementation((_url, _key, { cookies }) => ({
      auth: {
        getClaims: getClaims.mockImplementation(async () => {
          cookies.setAll(
            [{ name: "sb-auth", value: "new-token", options: { path: "/" } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: { claims: {} }, error: null };
        }),
      },
    }));
    const updateSession = await loadUpdateSession();

    const req = new NextRequest("http://localhost/", {
      headers: { cookie: "sb-auth=old-token" },
    });
    const res = await updateSession(req);

    expect(getClaims).toHaveBeenCalledOnce();
    expect(req.cookies.get("sb-auth")?.value).toBe("new-token");
    expect(res.cookies.get("sb-auth")?.value).toBe("new-token");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("registra gli errori di refresh ma non quelli di sessione assente", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { AuthSessionMissingError, AuthApiError } = await import(
      "@supabase/supabase-js"
    );
    createServerClient.mockReturnValue({ auth: { getClaims } });
    const updateSession = await loadUpdateSession();

    getClaims.mockResolvedValueOnce({
      data: null,
      error: new AuthSessionMissingError(),
    });
    await updateSession(new NextRequest("http://localhost/"));
    expect(error).not.toHaveBeenCalled();

    getClaims.mockResolvedValueOnce({
      data: null,
      error: new AuthApiError("boom", 500, "unexpected_failure"),
    });
    await updateSession(new NextRequest("http://localhost/"));
    expect(error).toHaveBeenCalledOnce();
  });
});
