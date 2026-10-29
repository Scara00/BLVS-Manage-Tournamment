// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** In-memory `cookies()` of next/headers. */
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (opts: string | { name: string }) =>
      void jar.delete(typeof opts === "string" ? opts : opts.name),
  }),
}));

/**
 * Stand-in for Supabase Auth with the behaviour BLVS-15 relies on: each
 * signup email carries a new token that replaces the previous one, a token
 * works once, and it expires after `otp_expiry`.
 */
const gotrue = vi.hoisted(() => {
  const state = {
    tokens: new Map<string, { email: string; issuedAt: number }>(),
    latest: new Map<string, string>(),
    confirmed: new Set<string>(),
    sent: 0,
    failNext: null as null | { status: number; code?: string; message: string },
  };
  return {
    state,
    reset() {
      state.tokens.clear();
      state.latest.clear();
      state.confirmed.clear();
      state.sent = 0;
      state.failNext = null;
    },
    resend: vi.fn(async ({ email }: { email: string }) => {
      if (state.failNext) {
        const error = state.failNext;
        state.failNext = null;
        return { data: {}, error };
      }
      const token = `hash-${++state.sent}`;
      state.tokens.set(token, { email, issuedAt: Date.now() });
      state.latest.set(email, token);
      return { data: {}, error: null };
    }),
    verifyOtp: vi.fn(async ({ token_hash }: { token_hash: string }) => {
      const entry = state.tokens.get(token_hash);
      const expired = !entry || Date.now() - entry.issuedAt > 3600 * 1000;
      if (expired || state.latest.get(entry.email) !== token_hash) {
        return {
          data: {},
          error: {
            status: 403,
            code: "otp_expired",
            message: "Token has expired or is invalid",
          },
        };
      }
      state.tokens.delete(token_hash);
      state.confirmed.add(entry.email);
      return { data: { user: { email: entry.email } }, error: null };
    }),
  };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { resend: gotrue.resend, verifyOtp: gotrue.verifyOtp },
  }),
}));

const reinvio = await import("./reinvio/route");
const verifica =
  await import("../../../registrati/conferma-email/verifica/route");
const { PENDING_VERIFICATION_COOKIE, encodePending } =
  await import("@/lib/auth/email-verification/pending");
const { createMemoryRateLimitStore, setRateLimitStore } =
  await import("@/lib/auth/rate-limit");

const T0 = new Date("2026-10-27T12:00:00Z");

function resend(body?: unknown) {
  return reinvio.POST(
    new NextRequest("https://blvs.example/api/auth/conferma-email/reinvio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function openLink(tokenHash: string | null, type = "email") {
  const url = new URL(
    "https://blvs.example/registrati/conferma-email/verifica",
  );
  if (tokenHash) url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  return verifica.GET(new NextRequest(url));
}

function pendingCookie(email: string, inviataIl: Date) {
  jar.set(PENDING_VERIFICATION_COOKIE, encodePending({ email, inviataIl }));
}

function outcomeOf(response: Response) {
  return new URL(response.headers.get("location")!).searchParams.get("esito");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  jar.clear();
  setRateLimitStore(createMemoryRateLimitStore());
  gotrue.reset();
  gotrue.resend.mockClear();
  gotrue.verifyOtp.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/auth/conferma-email/reinvio", () => {
  it("senza una registrazione in attesa risponde 403 (permissionDenied)", async () => {
    const res = await resend();
    expect(res.status).toBe(403);
    expect(gotrue.resend).not.toHaveBeenCalled();
  });

  it("blocca il reinvio per 60 secondi e dice quanto manca", async () => {
    pendingCookie("nuovo@example.it", T0);
    vi.setSystemTime(new Date(T0.getTime() + 15_000));
    const res = await resend();
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("45");
    expect(await res.json()).toMatchObject({ attesaSecondi: 45 });
    expect(gotrue.resend).not.toHaveBeenCalled();
  });

  it("dopo 60 secondi invia un nuovo link e fa ripartire il blocco", async () => {
    pendingCookie("nuovo@example.it", T0);
    const later = new Date(T0.getTime() + 60_000);
    vi.setSystemTime(later);
    const res = await resend();
    expect(res.status).toBe(200);
    expect(gotrue.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "nuovo@example.it",
    });
    expect(await res.json()).toEqual({
      inviataIl: later.toISOString(),
      scadeIl: new Date(later.getTime() + 3600_000).toISOString(),
      attesaSecondi: 60,
    });

    vi.setSystemTime(new Date(later.getTime() + 1000));
    expect((await resend()).status).toBe(429);
    expect(gotrue.resend).toHaveBeenCalledTimes(1);
  });

  it("riporta l'attesa decisa da Supabase Auth", async () => {
    gotrue.state.failNext = {
      status: 429,
      code: "over_email_send_rate_limit",
      message:
        "For security purposes, you can only request this after 37 seconds.",
    };
    const res = await resend({ email: "Altro@Example.it" });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ attesaSecondi: 37 });
  });

  it("da un altro browser accetta l'indirizzo nel corpo, se valido", async () => {
    expect((await resend({ email: "non-una-email" })).status).toBe(422);
    const res = await resend({ email: "Altro@Example.it" });
    expect(res.status).toBe(200);
    expect(gotrue.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "altro@example.it",
    });
  });

  it("limita i reinvii per indirizzo anche senza il cookie, con la stessa risposta 429", async () => {
    for (let i = 0; i < 5; i++) {
      vi.setSystemTime(new Date(T0.getTime() + i * 61_000));
      expect((await resend({ email: "vittima@example.it" })).status).toBe(200);
    }
    vi.setSystemTime(new Date(T0.getTime() + 5 * 61_000));
    const res = await resend({ email: "vittima@example.it" });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({
      attesaSecondi: expect.any(Number),
    });
    expect(gotrue.resend).toHaveBeenCalledTimes(5);
  });

  it("un errore di Supabase Auth non espone dettagli", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    gotrue.state.failNext = { status: 500, message: "smtp down" };
    const res = await resend({ email: "a@example.it" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("smtp");
  });
});

describe("GET /registrati/conferma-email/verifica", () => {
  it("un nuovo link invalida il precedente", async () => {
    pendingCookie("nuovo@example.it", new Date(T0.getTime() - 120_000));
    await resend();
    const first = gotrue.state.latest.get("nuovo@example.it")!;
    vi.setSystemTime(new Date(T0.getTime() + 61_000));
    await resend();
    const second = gotrue.state.latest.get("nuovo@example.it")!;
    expect(second).not.toBe(first);

    expect(outcomeOf(await openLink(first))).toBe("scaduto");
    expect(jar.has(PENDING_VERIFICATION_COOKIE)).toBe(true);

    const ok = await openLink(second);
    expect(ok.status).toBe(303);
    expect(outcomeOf(ok)).toBe("confermata");
    expect(new URL(ok.headers.get("location")!).search).not.toContain("hash");
    expect(jar.has(PENDING_VERIFICATION_COOKIE)).toBe(false);
  });

  it("un link già usato porta allo stato scaduto", async () => {
    await resend({ email: "nuovo@example.it" });
    const token = gotrue.state.latest.get("nuovo@example.it")!;
    expect(outcomeOf(await openLink(token))).toBe("confermata");
    expect(outcomeOf(await openLink(token))).toBe("scaduto");
  });

  it("un link scaduto porta allo stato scaduto", async () => {
    vi.useRealTimers();
    await resend({ email: "nuovo@example.it" });
    const token = gotrue.state.latest.get("nuovo@example.it")!;
    gotrue.state.tokens.get(token)!.issuedAt -= 3601 * 1000;
    expect(outcomeOf(await openLink(token))).toBe("scaduto");
  });

  it("senza token o con un tipo diverso non chiama Supabase", async () => {
    expect(outcomeOf(await openLink(null))).toBe("scaduto");
    expect(outcomeOf(await openLink("hash-1", "recovery"))).toBe("scaduto");
    expect(gotrue.verifyOtp).not.toHaveBeenCalled();
  });
});
