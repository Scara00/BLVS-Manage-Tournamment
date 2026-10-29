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
      new NextRequest("https://localhost/tappe", {
        headers: { cookie: "sb-ref-auth-token=scaduto" },
      }),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://localhost/sessione-scaduta?da=%2Ftappe",
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

  it("cookie di sessione vuoti: niente «Sessione scaduta» per sempre, li cancella e manda al login", async () => {
    createServerClient.mockReturnValue({ auth: { getClaims } });
    getClaims.mockResolvedValue({ data: null, error: null });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/admin", {
        headers: { cookie: "sb-ref-auth-token.0=; sb-ref-auth-token.1=" },
      }),
    );
    expect(res.headers.get("location")).toBe(
      "https://localhost/accesso?da=%2Fadmin",
    );
    for (const name of ["sb-ref-auth-token.0", "sb-ref-auth-token.1"]) {
      expect(res.cookies.get(name)).toMatchObject({
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  });

  it.each([
    "/accesso",
    "/sessione-scaduta?da=/live",
    "/privacy",
    "/classifica",
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

  /** A signed-in client whose `utenti` read returns `profilo`. */
  function conProfilo(profilo: {
    data: { id: string } | null;
    error: { message: string } | null;
  }) {
    const signOut = vi.fn(async () => ({ error: null }));
    const eq = vi.fn(() => ({ maybeSingle: async () => profilo }));
    createServerClient.mockReturnValue({
      auth: { getClaims, signOut },
      from: () => ({ select: () => ({ eq }) }),
    });
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1" } },
      error: null,
    });
    return { signOut, eq };
  }

  it("chi ha già una sessione valida e apre il login torna alla pagina richiesta", async () => {
    const { eq } = conProfilo({ data: { id: "u1" }, error: null });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/accesso?da=//evil.example"),
    );
    expect(res.headers.get("location")).toBe("https://localhost/");
    const back = await updateSession(
      new NextRequest("https://localhost/accesso?da=%2Flive"),
    );
    expect(back.headers.get("location")).toBe("https://localhost/live");
    expect(eq).toHaveBeenCalledWith("id", "u1");
    // Dot segments must not collapse into another site.
    const fuori = await updateSession(
      new NextRequest("https://localhost/accesso?da=%2F.%2F%2Fevil.example"),
    );
    expect(fuori.headers.get("location")).toBe("https://localhost/");
  });

  it.each([["senza profilo (account cancellato)", null]])(
    "%s la sessione si chiude e il login resta: niente rimbalzo infinito con la pagina",
    async (_caso, data) => {
      const { signOut } = conProfilo({ data, error: null });
      const updateSession = await loadUpdateSession();

      const res = await updateSession(
        new NextRequest("https://localhost/accesso?da=%2Fadmin"),
      );
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(res.cookies.get("blvs_admin_scadenza")).toMatchObject({
        value: "",
        maxAge: 0,
      });
    },
  );

  it("con il profilo non leggibile il login resta e la sessione non si tocca", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { signOut } = conProfilo({ data: null, error: { message: "boom" } });
    const updateSession = await loadUpdateSession();

    const res = await updateSession(
      new NextRequest("https://localhost/accesso?da=%2Fadmin"),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      "[auth] lettura del profilo non riuscita",
      { message: "boom" },
    );
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

  describe("scadenza della sessione admin (BLVS-18)", () => {
    const NOW = new Date("2026-10-27T10:00:00Z").getTime();
    const signOut = vi.fn();

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      signOut.mockReset();
      createServerClient.mockImplementation((_url, _key, { cookies }) => ({
        auth: {
          getClaims: getClaims.mockResolvedValue({
            data: { claims: { sub: "u1" } },
            error: null,
          }),
          signOut: signOut.mockImplementation(async () => {
            cookies.setAll(
              [
                {
                  name: "sb-ref-auth-token",
                  value: "",
                  options: { maxAge: 0 },
                },
              ],
              { "Cache-Control": "private, no-store" },
            );
            return { error: null };
          }),
        },
      }));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const request = (
      path: string,
      deadline?: number,
      init: { method?: string; headers?: Record<string, string> } = {},
    ) =>
      new NextRequest(`https://localhost${path}`, {
        method: init.method,
        headers: {
          ...init.headers,
          cookie: [
            "sb-ref-auth-token=valido",
            deadline === undefined ? null : `blvs_admin_scadenza=${deadline}`,
          ]
            .filter(Boolean)
            .join("; "),
        },
      });

    it("la prima pagina admin fissa la scadenza a 2 ore, in un cookie httpOnly", async () => {
      const updateSession = await loadUpdateSession();
      const res = await updateSession(request("/admin"));
      const cookie = res.cookies.get("blvs_admin_scadenza");
      expect(cookie?.value).toBe(String(NOW + 2 * 60 * 60 * 1000));
      expect(cookie?.httpOnly).toBe(true);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("ogni pagina o richiesta admin sposta in avanti la scadenza", async () => {
      const updateSession = await loadUpdateSession();
      const page = await updateSession(request("/admin/tappe", NOW + 60_000));
      expect(page.cookies.get("blvs_admin_scadenza")?.value).toBe(
        String(NOW + 7_200_000),
      );
      const api = await updateSession(
        request("/api/admin/tappe", NOW + 60_000, { method: "POST" }),
      );
      expect(api.cookies.get("blvs_admin_scadenza")?.value).toBe(
        String(NOW + 7_200_000),
      );
    });

    it("il controllo del tempo rimasto e i prefetch non contano come attività", async () => {
      const updateSession = await loadUpdateSession();
      const poll = await updateSession(
        request("/api/admin/sessione", NOW + 60_000),
      );
      expect(poll.cookies.get("blvs_admin_scadenza")).toBeUndefined();
      const prefetch = await updateSession(
        request("/admin/tappe", NOW + 60_000, {
          headers: { "next-router-prefetch": "1" },
        }),
      );
      expect(prefetch.cookies.get("blvs_admin_scadenza")).toBeUndefined();
    });

    it("le pagine fuori dall'area admin non toccano la scadenza", async () => {
      const updateSession = await loadUpdateSession();
      const res = await updateSession(request("/classifica", NOW - 1));
      expect(res.cookies.get("blvs_admin_scadenza")).toBeUndefined();
      expect(signOut).not.toHaveBeenCalled();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("dopo la scadenza chiude la sessione e manda a «Sessione scaduta» con la pagina di ritorno", async () => {
      const updateSession = await loadUpdateSession();
      const res = await updateSession(
        request("/admin/tappe?stato=aperte", NOW),
      );
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(
        "https://localhost/sessione-scaduta?da=%2Fadmin%2Ftappe%3Fstato%3Daperte",
      );
      expect(res.cookies.get("sb-ref-auth-token")?.value).toBe("");
      expect(res.cookies.get("blvs_admin_scadenza")?.value).toBe("");
      expect(res.headers.get("cache-control")).toBe("private, no-store");
    });

    it("dopo la scadenza le API admin rispondono 401", async () => {
      const updateSession = await loadUpdateSession();
      const res = await updateSession(
        request("/api/admin/sessione", NOW - 1, { method: "POST" }),
      );
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        error: "La sessione di amministrazione è scaduta. Accedi di nuovo.",
      });
      expect(res.cookies.get("sb-ref-auth-token")?.value).toBe("");
    });
  });
});
