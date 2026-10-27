// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  AUTH_RATE_LIMITS,
  clientIp,
  createMemoryRateLimitStore,
  limitAuthAttempt,
  setRateLimitStore,
} = await import("./rate-limit");

const request = (ip = "203.0.113.7") =>
  new Request("https://blvs.example/api/auth/login", {
    method: "POST",
    headers: { "x-forwarded-for": `${ip}, 10.0.0.1` },
  });

describe("limitAuthAttempt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-06-12T10:00:00Z"));
    setRateLimitStore(createMemoryRateLimitStore());
  });

  afterEach(() => {
    vi.useRealTimers();
    setRateLimitStore(undefined);
  });

  it("blocca il sesto tentativo di login sullo stesso account con 429 e Retry-After", async () => {
    const max = AUTH_RATE_LIMITS.login.find((r) => r.scope === "email")!.max;
    for (let i = 0; i < max; i++) {
      // IP diversi: conta il limite per account.
      expect(
        await limitAuthAttempt(
          request(`198.51.100.${i}`),
          "login",
          "Mario@X.it",
        ),
      ).toBeNull();
    }

    const res = await limitAuthAttempt(
      request("198.51.100.99"),
      "login",
      "mario@x.it",
    );
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe(String(15 * 60));
    expect(await res?.json()).toEqual({
      error: "Troppi tentativi. Riprova tra qualche minuto.",
    });
  });

  it("limita anche per IP, su account diversi", async () => {
    const max = AUTH_RATE_LIMITS.login.find((r) => r.scope === "ip")!.max;
    for (let i = 0; i < max; i++) {
      expect(
        await limitAuthAttempt(request(), "login", `u${i}@x.it`),
      ).toBeNull();
    }
    expect(
      (await limitAuthAttempt(request(), "login", "altro@x.it"))?.status,
    ).toBe(429);
  });

  it("riapre allo scadere della finestra", async () => {
    for (let i = 0; i < 6; i++)
      await limitAuthAttempt(request(), "login", "a@x.it");
    expect((await limitAuthAttempt(request(), "login", "a@x.it"))?.status).toBe(
      429,
    );

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(await limitAuthAttempt(request(), "login", "a@x.it")).toBeNull();
  });

  it("login e registrazione hanno contatori separati", async () => {
    for (let i = 0; i < 6; i++)
      await limitAuthAttempt(request(), "login", "a@x.it");
    expect(await limitAuthAttempt(request(), "register", "a@x.it")).toBeNull();
  });

  it("se il contatore non risponde rifiuta la richiesta (503)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitStore({
      hit: async () => {
        throw new Error("db giù");
      },
    });
    expect((await limitAuthAttempt(request(), "login", "a@x.it"))?.status).toBe(
      503,
    );
  });
});

describe("clientIp", () => {
  it("usa il primo indirizzo di x-forwarded-for, poi x-real-ip", () => {
    expect(clientIp(request("203.0.113.7"))).toBe("203.0.113.7");
    expect(
      clientIp(
        new Request("https://x", { headers: { "x-real-ip": "192.0.2.1" } }),
      ),
    ).toBe("192.0.2.1");
    expect(clientIp(new Request("https://x"))).toBe("sconosciuto");
  });
});
