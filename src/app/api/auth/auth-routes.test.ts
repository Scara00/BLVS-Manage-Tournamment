// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { signInWithPassword, signUp, signOut } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signInWithPassword, signUp, signOut } }),
}));

const login = await import("./login/route");
const register = await import("./register/route");
const logout = await import("./logout/route");
const { createMemoryRateLimitStore, setRateLimitStore } =
  await import("@/lib/auth/rate-limit");
const { EMAIL_TAKEN_MESSAGE, REGISTERED_MESSAGE } =
  await import("@/lib/auth/messages");
const { CONSENT_REQUIRED_MESSAGE } = await import("@/lib/auth/signup");
const { PRIVACY_POLICY_VERSION } = await import("@/lib/legal/privacy-policy");

function post(path: string, body: unknown, ip = "203.0.113.7") {
  return new NextRequest(`https://blvs.example${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const validRegistration = {
  email: "Nuovo@Example.it",
  password: "una-password-lunga",
  nome: "Nuovo",
  cognome: "Giocatore",
  categoria: "F",
  consensoPrivacy: true,
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  setRateLimitStore(createMemoryRateLimitStore());
  signInWithPassword.mockReset();
  signUp.mockReset();
  signOut.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setRateLimitStore(undefined);
});

describe("POST /api/auth/login", () => {
  it("accede con credenziali valide", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "a@x.it" } },
      error: null,
    });
    const res = await login.POST(
      post("/api/auth/login", { email: "A@x.it", password: "segreta" }),
    );
    expect(res.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@x.it",
      password: "segreta",
    });
  });

  it("risponde 401 generico con credenziali errate", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials" },
    });
    const res = await login.POST(
      post("/api/auth/login", { email: "a@x.it", password: "no" }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Email o password non corretti.",
    });
  });

  it("al sesto tentativo sullo stesso account risponde 429 senza chiamare Supabase", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { status: 400, code: "invalid_credentials" },
    });
    for (let i = 0; i < 5; i++) {
      await login.POST(
        post(
          "/api/auth/login",
          { email: "a@x.it", password: "no" },
          `198.51.100.${i}`,
        ),
      );
    }
    signInWithPassword.mockClear();

    const res = await login.POST(
      post("/api/auth/login", { email: "a@x.it", password: "no" }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("conta anche i tentativi con un corpo non valido", async () => {
    for (let i = 0; i < 20; i++) {
      expect(
        (await login.POST(post("/api/auth/login", "non json"))).status,
      ).toBe(400);
    }
    expect((await login.POST(post("/api/auth/login", "non json"))).status).toBe(
      429,
    );
  });

  it("valida i campi", async () => {
    const res = await login.POST(
      post("/api/auth/login", { email: "x", password: "" }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      fields: { email: expect.any(String), password: "Campo obbligatorio." },
    });
  });
});

describe("POST /api/auth/register", () => {
  it("registra un giocatore con il consenso privacy e lo connette", async () => {
    signUp.mockResolvedValue({
      data: {
        user: { id: "u1", identities: [{ id: "i1" }] },
        session: { access_token: "t" },
      },
      error: null,
    });
    const res = await register.POST(
      post("/api/auth/register", validRegistration),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      messaggio: REGISTERED_MESSAGE,
      connesso: true,
    });
    expect(signUp).toHaveBeenCalledWith({
      email: "nuovo@example.it",
      password: "una-password-lunga",
      options: {
        data: {
          nome: "Nuovo",
          cognome: "Giocatore",
          categoria: "F",
          consenso_privacy: PRIVACY_POLICY_VERSION.number,
          consenso_privacy_data: PRIVACY_POLICY_VERSION.date,
        },
      },
    });
  });

  it("non accetta un ruolo dal client", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await register.POST(
      post("/api/auth/register", { ...validRegistration, ruolo: "admin" }),
    );
    expect(JSON.stringify(signUp.mock.calls[0])).not.toContain("admin");
  });

  it("richiede consenso, categoria e una password di almeno 10 caratteri", async () => {
    const res = await register.POST(
      post("/api/auth/register", {
        ...validRegistration,
        password: "corta",
        categoria: "X",
        consensoPrivacy: false,
      }),
    );
    expect(res.status).toBe(422);
    expect(Object.keys((await res.json()).fields).sort()).toEqual([
      "categoria",
      "consensoPrivacy",
      "password",
    ]);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("senza sessione (conferma email attiva) chiede di confermare", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "u1", identities: [{ id: "i1" }] }, session: null },
      error: null,
    });
    const res = await register.POST(
      post("/api/auth/register", validRegistration),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ connesso: false });
  });

  it("un'email già registrata, con maiuscole diverse, risponde 409 sul campo", async () => {
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "user_already_exists" },
    });
    const res = await register.POST(
      post("/api/auth/register", {
        ...validRegistration,
        email: "  NUOVO@example.IT ",
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: EMAIL_TAKEN_MESSAGE,
      fields: { email: EMAIL_TAKEN_MESSAGE },
    });
    expect(signUp.mock.calls[0][0].email).toBe("nuovo@example.it");
  });

  it("riconosce l'email già registrata anche con la conferma email attiva", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "finto", identities: [] }, session: null },
      error: null,
    });
    const res = await register.POST(
      post("/api/auth/register", validRegistration),
    );
    expect(res.status).toBe(409);
  });

  it("senza consenso non registra e lo dice sul campo", async () => {
    const { consensoPrivacy: _omesso, ...senzaConsenso } = validRegistration;
    void _omesso;
    const res = await register.POST(post("/api/auth/register", senzaConsenso));
    expect(res.status).toBe(422);
    expect((await res.json()).fields).toEqual({
      consensoPrivacy: CONSENT_REQUIRED_MESSAGE,
    });
    expect(signUp).not.toHaveBeenCalled();
  });

  it("limita le registrazioni per IP", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    for (let i = 0; i < 5; i++) {
      await register.POST(
        post("/api/auth/register", {
          ...validRegistration,
          email: `n${i}@x.it`,
        }),
      );
    }
    const res = await register.POST(
      post("/api/auth/register", { ...validRegistration, email: "z@x.it" }),
    );
    expect(res.status).toBe(429);
  });
});

describe("POST /api/auth/logout", () => {
  it("chiude la sessione", async () => {
    signOut.mockResolvedValue({ error: null });
    const res = await logout.POST();
    expect(res.status).toBe(204);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
