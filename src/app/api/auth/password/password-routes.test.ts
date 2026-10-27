// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  verifyOtp,
  updateUser,
  signOut,
  getClaims,
  sendRecoveryEmail,
  scheduled,
} = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getClaims: vi.fn(),
  sendRecoveryEmail: vi.fn(),
  scheduled: [] as Array<() => unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { verifyOtp, updateUser, signOut, getClaims },
  }),
}));
vi.mock("@/lib/auth/password-reset/send", () => ({ sendRecoveryEmail }));
// `after()` needs a request scope: collect the callbacks and run them by hand.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    scheduled.push(fn);
  },
}));

const richiesta = await import("./richiesta/route");
const reimposta = await import("./reimposta/route");
const { createMemoryRateLimitStore, setRateLimitStore } =
  await import("@/lib/auth/rate-limit");

function post(path: string, body: unknown, ip = "203.0.113.9") {
  return new NextRequest(`https://blvs.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function snapshot(res: Response) {
  return {
    status: res.status,
    body: await res.text(),
    type: res.headers.get("content-type"),
  };
}

const NEW_PASSWORD = "Nuova-password-2026";
const valid = {
  tokenHash: "hash-del-token",
  password: NEW_PASSWORD,
  conferma: NEW_PASSWORD,
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  setRateLimitStore(createMemoryRateLimitStore());
  for (const fn of [
    verifyOtp,
    updateUser,
    signOut,
    getClaims,
    sendRecoveryEmail,
  ]) {
    fn.mockReset();
  }
  scheduled.length = 0;
  verifyOtp.mockResolvedValue({ data: {}, error: null });
  updateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  signOut.mockResolvedValue({ error: null });
  getClaims.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  setRateLimitStore(undefined);
});

describe("POST /api/auth/password/richiesta", () => {
  it("dà la stessa risposta per email registrate, inesistenti e invii falliti", async () => {
    // Registered: Supabase sends. Unknown: Supabase does nothing. Failing:
    // the send errors. The route cannot tell them apart, by design.
    const outcomes = [
      () => Promise.resolve(),
      () => Promise.resolve(),
      () => Promise.reject(new Error("smtp giù")),
    ];
    const answers = [];
    for (const [i, email] of [
      "registrato@example.it",
      "inesistente@example.it",
      "errore@example.it",
    ].entries()) {
      sendRecoveryEmail.mockImplementationOnce(outcomes[i]);
      answers.push(
        await snapshot(
          await richiesta.POST(post("/api/auth/password/richiesta", { email })),
        ),
      );
    }
    expect(answers[0]).toEqual({
      status: 202,
      body: JSON.stringify({
        messaggio:
          "Se l'indirizzo è registrato riceverai un'email con il link per scegliere una nuova password.",
      }),
      type: "application/json",
    });
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
  });

  it("risponde senza aspettare l'invio: l'email parte dopo la risposta", async () => {
    // A send that never ends would hang the request if it were awaited.
    sendRecoveryEmail.mockReturnValue(new Promise(() => {}));
    const res = await richiesta.POST(
      post("/api/auth/password/richiesta", { email: "Lenta@Example.it" }),
    );
    expect(res.status).toBe(202);
    expect(sendRecoveryEmail).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    scheduled[0]();
    expect(sendRecoveryEmail).toHaveBeenCalledWith(
      {
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_test",
      },
      "lenta@example.it",
    );
  });

  it("422 con errore sul campo per un'email non valida, senza invio", async () => {
    const res = await richiesta.POST(
      post("/api/auth/password/richiesta", { email: "non-una-email" }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).fields.email).toMatch(/email valida/);
    expect(scheduled).toHaveLength(0);
  });

  it("limita le richieste per email con 429 e Retry-After", async () => {
    let res: Response | undefined;
    for (let i = 0; i < 6; i++) {
      res = await richiesta.POST(
        post(
          "/api/auth/password/richiesta",
          { email: "insistente@example.it" },
          `198.51.100.${i}`,
        ),
      );
    }
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
  });

  it("503 senza Supabase configurato", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await richiesta.POST(
      post("/api/auth/password/richiesta", { email: "a@example.it" }),
    );
    expect(res.status).toBe(503);
  });
});

describe("POST /api/auth/password/reimposta", () => {
  it("salva la password e chiude le altre sessioni, non questa", async () => {
    const res = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      messaggio:
        "Password aggiornata. Abbiamo chiuso le sessioni aperte sugli altri dispositivi.",
      altreSessioniChiuse: true,
    });
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash-del-token",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: NEW_PASSWORD });
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "others" });
    // Order: spend the token, set the password, then revoke the others.
    expect(verifyOtp.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0],
    );
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0],
    );
  });

  it("monouso: il secondo uso dello stesso link risponde 410 e non cambia nulla", async () => {
    const first = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(first.status).toBe(200);

    // Supabase deletes the token hash once verified.
    verifyOtp.mockResolvedValueOnce({
      data: {},
      error: {
        status: 403,
        code: "otp_expired",
        message: "Token has expired or is invalid",
      },
    });
    const second = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(second.status).toBe(410);
    expect(await second.json()).toEqual({
      error: "Il link è scaduto o è già stato usato. Chiedine uno nuovo.",
      stato: "link-non-valido",
    });
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("scadenza: un link oltre i 60 minuti risponde 410", async () => {
    verifyOtp.mockResolvedValue({
      data: {},
      error: { status: 403, code: "otp_expired", message: "Token has expired" },
    });
    const res = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(res.status).toBe(410);
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("controlla i requisiti prima di consumare il link", async () => {
    const res = await reimposta.POST(
      post("/api/auth/password/reimposta", {
        tokenHash: "hash",
        password: "solo-lettere-qui",
        conferma: "diversa",
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.fields.password).toMatch(/almeno un numero/);
    expect(body.fields.conferma).toBe("Le due password non coincidono.");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("se la password è uguale alla vecchia permette di riprovare con la sessione di recupero", async () => {
    updateUser.mockResolvedValueOnce({
      data: {},
      error: { status: 422, code: "same_password" },
    });
    const first = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(first.status).toBe(422);
    expect(await first.json()).toMatchObject({
      fields: { password: "Scegli una password diversa da quella attuale." },
      sessioneRecupero: true,
    });
    expect(signOut).not.toHaveBeenCalled();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T10:30:00Z"));
    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "u1",
          amr: [
            {
              method: "recovery",
              timestamp: Date.parse("2026-10-27T10:10:00Z") / 1000,
            },
          ],
        },
      },
      error: null,
    });
    const retry = await reimposta.POST(
      post("/api/auth/password/reimposta", {
        password: "Altra-password-2026",
        conferma: "Altra-password-2026",
      }),
    );
    expect(retry.status).toBe(200);
    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("senza link serve una sessione di recupero recente, non un accesso normale", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    const body = { password: NEW_PASSWORD, conferma: NEW_PASSWORD };

    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "u1",
          amr: [
            {
              method: "password",
              timestamp: Date.parse("2026-10-27T11:59:00Z") / 1000,
            },
          ],
        },
      },
      error: null,
    });
    expect(
      (await reimposta.POST(post("/api/auth/password/reimposta", body))).status,
    ).toBe(410);

    getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "u1",
          amr: [
            {
              method: "recovery",
              timestamp: Date.parse("2026-10-27T10:30:00Z") / 1000,
            },
          ],
        },
      },
      error: null,
    });
    expect(
      (await reimposta.POST(post("/api/auth/password/reimposta", body))).status,
    ).toBe(410);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("riprova una volta la chiusura delle altre sessioni e lo dice se non riesce", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    signOut.mockResolvedValue({ error: { status: 500, message: "giù" } });
    const res = await reimposta.POST(
      post("/api/auth/password/reimposta", valid),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ altreSessioniChiuse: false });
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("un token non stringa vale come link non valido", async () => {
    const res = await reimposta.POST(
      post("/api/auth/password/reimposta", { ...valid, tokenHash: 42 }),
    );
    expect(res.status).toBe(410);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
