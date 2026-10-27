// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./session", () => ({ getCurrentUser: mocks.getCurrentUser }));

const { requireAdmin } = await import("./require-admin");

/** `forbidden()` / `redirect()` throw: read what Next would answer. */
async function outcome(run: () => Promise<unknown>) {
  try {
    return { value: await run() };
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    const status = /^NEXT_HTTP_ERROR_FALLBACK;(\d{3})$/.exec(digest);
    if (status) return { status: Number(status[1]) };
    if (digest.startsWith("NEXT_REDIRECT")) {
      return { redirect: digest.split(";")[2] };
    }
    throw error;
  }
}

describe("requireAdmin", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset();
    vi.stubEnv("__NEXT_EXPERIMENTAL_AUTH_INTERRUPTS", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("un giocatore riceve 403", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "g", ruolo: "giocatore" });
    expect(await outcome(() => requireAdmin())).toEqual({ status: 403 });
  });

  it("senza sessione va al login, ricordando la pagina", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect(await outcome(() => requireAdmin("/admin/tappe"))).toEqual({
      redirect: "/accesso?da=%2Fadmin%2Ftappe",
    });
  });

  it("l'admin passa e riceve l'utente", async () => {
    const user = { id: "a", ruolo: "admin" };
    mocks.getCurrentUser.mockResolvedValue(user);
    expect(await outcome(() => requireAdmin())).toEqual({ value: user });
  });

  it("senza Supabase (CI, e2e) non controlla nulla", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(await outcome(() => requireAdmin())).toEqual({ value: null });
    expect(mocks.getCurrentUser).not.toHaveBeenCalled();
  });
});
