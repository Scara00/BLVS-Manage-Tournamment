// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: signOutMock } }),
}));

const { signOut } = await import("./actions");
const { SIGN_OUT_ERROR_MESSAGE } = await import("./sign-out-state");

describe("signOut", () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
    redirectMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("chiude la sessione Supabase e torna alla home", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
    await signOut();
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("senza configurazione Supabase reindirizza soltanto", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    await signOut();
    expect(signOutMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("se Supabase non chiude la sessione restituisce l'errore e non reindirizza", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
    const error = new Error("network");
    signOutMock.mockResolvedValue({ error });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(signOut()).resolves.toEqual({ error: SIGN_OUT_ERROR_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[auth] signOut failed", error);
    consoleError.mockRestore();
  });
});
