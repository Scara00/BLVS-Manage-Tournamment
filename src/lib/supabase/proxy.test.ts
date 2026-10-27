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
          return { data: { claims: { sub: "u1" } }, error: null };
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
    const { AuthSessionMissingError, AuthApiError } =
      await import("@supabase/supabase-js");
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

  it("senza sessione risponde 403 alle API admin, ma lascia passare le altre API", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();

    const admin = await updateSession(
      new NextRequest("https://localhost/api/admin/tappe"),
    );
    expect(admin.status).toBe(403);
    expect(await admin.json()).toEqual({ error: "Accesso negato." });

    const api = await updateSession(
      new NextRequest("https://localhost/api/live/snapshot"),
    );
    expect(api.headers.get("x-middleware-next")).toBe("1");
  });

  it("senza sessione manda le pagine protette al login, con la pagina di ritorno", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/admin/tappe?stato=aperte"),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://localhost/accesso?da=%2Fadmin%2Ftappe%3Fstato%3Daperte",
    );
  });

  it("con un cookie di sessione non più valido manda a «Sessione scaduta» e ne conserva la pulizia", async () => {
    createServerClient.mockImplementation((_url, _key, { cookies }) => ({
      auth: {
        getClaims: getClaims.mockImplementation(async () => {
          cookies.setAll(
            [{ name: "sb-ref-auth-token", value: "", options: { maxAge: 0 } }],
            { "Cache-Control": "private, no-store" },
          );
          return { data: null, error: null };
        }),
      },
    }));
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/classifica", {
        headers: { cookie: "sb-ref-auth-token=scaduto" },
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://localhost/sessione-scaduta?da=%2Fclassifica",
    );
    expect(res.cookies.get("sb-ref-auth-token")?.value).toBe("");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("riconosce anche i cookie di sessione divisi in parti", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/", {
        headers: { cookie: "sb-ref-auth-token.0=a; sb-ref-auth-token.1=b" },
      }),
    );
    expect(res.headers.get("location")).toBe(
      "https://localhost/sessione-scaduta",
    );
  });

  it.each([
    "/accesso",
    "/sessione-scaduta?da=/live",
    "/privacy",
    "/anteprima/503",
  ])("senza sessione %s resta raggiungibile", async (path) => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();
    const res = await updateSession(
      new NextRequest(`https://localhost${path}`),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("non reindirizza le server action (POST), che si proteggono da sole", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();
    const res = await updateSession(
      new NextRequest("https://localhost/classifica", { method: "POST" }),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("chi ha già una sessione valida e apre il login torna alla pagina richiesta", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/accesso?da=//evil.example"),
    );
    expect(res.headers.get("location")).toBe("https://localhost/");
    const back = await updateSession(
      new NextRequest("https://localhost/accesso?da=%2Flive"),
    );
    expect(back.headers.get("location")).toBe("https://localhost/live");
  });

  it("con una sessione valida lascia la verifica del ruolo al Route Handler", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/api/admin/tappe"),
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("senza env Supabase le API admin rispondono 403", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("http://localhost/api/admin/utenti"),
    );
    expect(res.status).toBe(403);
  });
});
