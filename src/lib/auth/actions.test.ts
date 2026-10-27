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

describe("signOut", () => {
  beforeEach(() => {
    signOutMock.mockReset();
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
});
