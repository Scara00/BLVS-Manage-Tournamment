// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Integration: the real Proxy in front of real Route Handlers, as on
 * staging/production (`ENFORCE_HTTPS=true`), without a Supabase project.
 */
const { proxy } = await import("./proxy");
const login = await import("./app/api/auth/login/route");
const tappe = await import("./app/api/admin/tappe/route");
const nextConfig = (await import("../next.config")).default;

type RouteHandler = (
  request: NextRequest,
  context: unknown,
) => Promise<Response>;

/** Runs the Proxy, then the handler only if the Proxy let the request through. */
async function serve(request: NextRequest, handler: RouteHandler) {
  const res = await proxy(request);
  if (res.headers.get("x-middleware-next") !== "1") return res;
  return handler(request, { params: Promise.resolve({}) });
}

function post(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ email: "non-una-email", password: "" }),
  });
}

describe("API solo su HTTPS", () => {
  beforeEach(() => {
    vi.stubEnv("ENFORCE_HTTPS", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rifiuta con 403 il login in HTTP, senza raggiungere l'handler né reindirizzare", async () => {
    const res = await serve(
      post("http://blvs.example/api/auth/login"),
      login.POST,
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.json()).toEqual({ error: "HTTPS obbligatorio." });
  });

  it("riconosce l'HTTP originale da x-forwarded-proto dietro al proxy TLS", async () => {
    const res = await serve(
      post("https://blvs.example/api/auth/login", {
        "x-forwarded-proto": "http",
      }),
      login.POST,
    );
    expect(res.status).toBe(403);
  });

  it("rifiuta in HTTP anche le API admin", async () => {
    const res = await serve(
      new NextRequest("http://blvs.example/api/admin/tappe"),
      tappe.GET as RouteHandler,
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "HTTPS obbligatorio." });
  });

  it("in HTTPS la richiesta arriva all'handler", async () => {
    const res = await serve(
      post("https://blvs.example/api/auth/login"),
      login.POST,
    );
    // 422: è l'handler che ha validato il corpo.
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      fields: { email: expect.any(String) },
    });
  });

  it("le pagine in HTTP sono reindirizzate su HTTPS con 308", async () => {
    const res = await proxy(new NextRequest("http://blvs.example/tappe"));
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("https://blvs.example/tappe");
  });

  it("le risposte HTTPS portano HSTS", async () => {
    const rules = await nextConfig.headers!();
    const headers =
      rules.find((rule) => rule.source === "/:path*")?.headers ?? [];
    expect(headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  });
});
