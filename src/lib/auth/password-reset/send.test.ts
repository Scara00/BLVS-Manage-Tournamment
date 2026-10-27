// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createClient, resetPasswordForEmail } = vi.hoisted(() => ({
  createClient: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const { sendRecoveryEmail } = await import("./send");
const env = { url: "https://x.supabase.co", publishableKey: "sb_publishable" };

beforeEach(() => {
  createClient.mockReset();
  resetPasswordForEmail.mockReset();
  createClient.mockReturnValue({ auth: { resetPasswordForEmail } });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendRecoveryEmail", () => {
  it("usa un client senza cookie nel flusso implicito (token_hash semplice)", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    await sendRecoveryEmail(env, "a@example.it");
    expect(createClient).toHaveBeenCalledWith(
      env.url,
      env.publishableKey,
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: false,
          flowType: "implicit",
        }),
      }),
    );
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@example.it");
  });

  it("non lancia e non registra l'indirizzo se Supabase fallisce", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    resetPasswordForEmail.mockRejectedValue(new Error("rete"));
    await expect(sendRecoveryEmail(env, "segreto@example.it")).resolves.toBe(
      undefined,
    );
    resetPasswordForEmail.mockResolvedValue({ error: { status: 500 } });
    await sendRecoveryEmail(env, "segreto@example.it");
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain("segreto@example.it");
  });
});
