// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/session";

vi.mock("server-only", () => ({}));

// Hoisted: the eager glob below becomes static imports of the routes.
const { getCurrentUser } = vi.hoisted(() => ({
  getCurrentUser: vi.fn<() => Promise<CurrentUser | null>>(),
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser }));

const { isAdminGuarded } = await import("@/lib/auth/guards");

/** Every admin Route Handler, found on disk: a new route is covered automatically. */
const modules = import.meta.glob<Record<string, unknown>>("./**/route.ts", {
  eager: true,
});

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];
const SAMPLE_ID = "00000000-0000-4000-8000-000000000001";

type Handler = (request: NextRequest, context: unknown) => Promise<Response>;

const routes = Object.entries(modules).flatMap(([file, mod]) =>
  HTTP_METHODS.filter((method) => method in mod).map((method) => ({
    file,
    method,
    handler: mod[method] as Handler,
    url: `https://blvs.example/api/admin/${file
      .replace(/^\.\//, "")
      .replace(/\/?route\.ts$/, "")
      .replaceAll("[id]", SAMPLE_ID)}`,
  })),
);

/**
 * A query builder that records nothing and resolves every chain to `result`.
 * Any query reaching it from a non-admin would be a failed authorization.
 */
function fakeSupabase(result: { data: unknown; error: unknown }) {
  const touched = vi.fn();
  const builder: unknown = new Proxy(() => {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) => resolve(result);
      }
      touched(prop);
      return () => builder;
    },
  });
  return { client: builder as CurrentUser["supabase"], touched };
}

function call({ handler, method, url }: (typeof routes)[number]) {
  const hasBody = !["GET", "HEAD", "DELETE"].includes(method);
  return handler(
    new NextRequest(url, {
      method,
      headers: { "content-type": "application/json" },
      body: hasBody ? JSON.stringify({}) : undefined,
    }),
    { params: Promise.resolve({ id: SAMPLE_ID }) },
  );
}

describe("rotte admin", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  it("le rotte sono state trovate tutte", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it.each(routes)("$method $file è protetta da withAdmin", ({ handler }) => {
    expect(isAdminGuarded(handler)).toBe(true);
  });

  it.each(routes)(
    "$method $file risponde 403 a un giocatore",
    async (route) => {
      const { client, touched } = fakeSupabase({ data: [], error: null });
      getCurrentUser.mockResolvedValue({
        id: SAMPLE_ID,
        email: "giocatore@example.it",
        ruolo: "giocatore",
        supabase: client,
      });

      const res = await call(route);

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "Accesso negato." });
      expect(touched).not.toHaveBeenCalled();
    },
  );

  it.each(routes)(
    "$method $file risponde 403 senza sessione",
    async (route) => {
      getCurrentUser.mockResolvedValue(null);
      const res = await call(route);
      expect(res.status).toBe(403);
    },
  );

  it("risponde 403 se la verifica della sessione fallisce", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getCurrentUser.mockRejectedValue(new Error("rete giù"));
    const res = await call(routes[0]);
    expect(res.status).toBe(403);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("un admin raggiunge l'handler", async () => {
    const tappe = [{ id: SAMPLE_ID, nome: "Tappa 1 · Jesolo" }];
    const { client } = fakeSupabase({ data: tappe, error: null });
    getCurrentUser.mockResolvedValue({
      id: SAMPLE_ID,
      email: "admin@example.it",
      ruolo: "admin",
      supabase: client,
    });

    const route = routes.find(
      (r) => r.method === "GET" && r.file === "./tappe/route.ts",
    )!;
    const res = await call(route);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tappe });
  });
});
