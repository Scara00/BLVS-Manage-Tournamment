// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A tiny in-memory Supabase: `signInWithPassword` opens a session for the
 * known account, `signOut` revokes it, `getClaims` reads it. It lets the
 * tests check that after «Esci» the server no longer sees a user.
 */
const auth = vi.hoisted(() => ({
  session: null as null | { sub: string },
  ruolo: "giocatore" as "giocatore" | "admin",
  signOutError: null as Error | null,
  /** Overrides the `utenti` read (missing, deleted or failing profile). */
  profilo: undefined as
    | undefined
    | {
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      },
}));
const signInWithPassword = vi.fn(
  async ({ email, password }: { email: string; password: string }) => {
    if (email === "mario@blvs.it" && password === "Demo-BLVS-2026!") {
      auth.session = { sub: "u1" };
      return { data: { user: { id: "u1", email } }, error: null };
    }
    return {
      data: { user: null },
      error: Object.assign(new Error("Invalid login credentials"), {
        status: 400,
      }),
    };
  },
);
const signOutMock = vi.fn(async () => {
  if (auth.signOutError) return { error: auth.signOutError };
  auth.session = null;
  return { error: null };
});
const cookieSet = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { path });
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ set: cookieSet }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      signOut: signOutMock,
      getClaims: async () => ({
        data: auth.session ? { claims: auth.session } : null,
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () =>
            auth.profilo ?? {
              data: { id, email: "mario@blvs.it", ruolo: auth.ruolo },
              error: null,
            },
        }),
      }),
    }),
  }),
}));

const { signIn, signOut } = await import("./actions");
const { getCurrentUser } = await import("./session");
const { SIGN_OUT_ERROR_MESSAGE } = await import("./sign-out-state");
const { initialSignInState, NO_PROFILE_MESSAGE, PERMISSION_DENIED_MESSAGE } =
  await import("./sign-in-state");
const { AUTH_RATE_LIMITS, createMemoryRateLimitStore, setRateLimitStore } =
  await import("./rate-limit");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.set(name, value));
  return data;
}

const valid = { email: "mario@blvs.it", password: "Demo-BLVS-2026!" };

async function redirectedTo(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toMatchObject({ message: "NEXT_REDIRECT" });
  return (error as { path: string }).path;
}

function withSupabaseEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
}

beforeEach(() => {
  auth.session = null;
  auth.ruolo = "giocatore";
  auth.signOutError = null;
  auth.profilo = undefined;
  signInWithPassword.mockClear();
  signOutMock.mockClear();
  redirectMock.mockClear();
  cookieSet.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
  setRateLimitStore(createMemoryRateLimitStore());
  withSupabaseEnv();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  setRateLimitStore(undefined);
});

describe("signIn: redirect di ritorno", () => {
  it("dopo l'accesso torna alla pagina di partenza interna", async () => {
    const path = await redirectedTo(
      signIn(initialSignInState, form({ ...valid, da: "/live?girone=a" })),
    );
    expect(path).toBe("/live?girone=a");
  });

  it.each([
    "https://evil.example/live",
    "//evil.example",
    "/\\evil.example",
    "/accesso?da=/live",
    "/sessione-scaduta",
  ])("con da=%j torna alla home", async (da) => {
    expect(
      await redirectedTo(signIn(initialSignInState, form({ ...valid, da }))),
    ).toBe("/");
  });

  it("un admin torna all'area admin", async () => {
    auth.ruolo = "admin";
    expect(
      await redirectedTo(
        signIn(initialSignInState, form({ ...valid, da: "/admin/tappe" })),
      ),
    ).toBe("/admin/tappe");
  });

  it("un admin senza pagina di ritorno va alla dashboard admin", async () => {
    auth.ruolo = "admin";
    expect(await redirectedTo(signIn(initialSignInState, form(valid)))).toBe(
      "/admin",
    );
  });

  it("un admin che partiva da una pagina giocatore ci torna", async () => {
    auth.ruolo = "admin";
    expect(
      await redirectedTo(
        signIn(initialSignInState, form({ ...valid, da: "/tappe" })),
      ),
    ).toBe("/tappe");
  });

  it("un giocatore senza pagina di ritorno va alla home", async () => {
    expect(await redirectedTo(signIn(initialSignInState, form(valid)))).toBe(
      "/",
    );
  });

  it("un giocatore che partiva dall'area admin riceve permissionDenied", async () => {
    const state = await signIn(
      initialSignInState,
      form({ ...valid, da: "/admin/tappe" }),
    );
    expect(state).toMatchObject({
      status: "permissionDenied",
      message: PERMISSION_DENIED_MESSAGE,
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("scadenza della sessione admin (BLVS-18)", () => {
  const cancellata = [
    "blvs_admin_scadenza",
    "",
    expect.objectContaining({ path: "/", maxAge: 0 }),
  ];

  it("ogni accesso riparte senza la scadenza della sessione precedente", async () => {
    auth.ruolo = "admin";
    await redirectedTo(signIn(initialSignInState, form(valid)));
    expect(cookieSet).toHaveBeenCalledWith(...cancellata);
  });

  it("un accesso fallito non tocca la scadenza", async () => {
    await signIn(initialSignInState, form({ ...valid, password: "sbagliata" }));
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("«Esci» la cancella, solo se la sessione si è chiusa davvero", async () => {
    auth.session = { sub: "u1" };
    await redirectedTo(signOut());
    expect(cookieSet).toHaveBeenCalledWith(...cancellata);

    cookieSet.mockClear();
    auth.signOutError = new Error("network");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await signOut();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

describe("signIn: account senza profilo", () => {
  it.each([["senza profilo (account cancellato)", null]])(
    "%s non entra: chiude la sessione e lo dice, invece di rimbalzare al login",
    async (_caso, data) => {
      auth.profilo = { data, error: null };
      const state = await signIn(initialSignInState, form(valid));
      expect(state).toMatchObject({
        status: "noProfile",
        message: NO_PROFILE_MESSAGE,
        email: valid.email,
      });
      expect(redirectMock).not.toHaveBeenCalled();
      expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
      expect(auth.session).toBeNull();
    },
  );

  it("profilo non leggibile: accesso non disponibile, sessione chiusa", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    auth.profilo = { data: null, error: { message: "boom" } };
    expect(await signIn(initialSignInState, form(valid))).toMatchObject({
      status: "unavailable",
    });
    expect(auth.session).toBeNull();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("signIn: errori", () => {
  it("credenziali errate: stesso messaggio generico per email sconosciuta e password sbagliata", async () => {
    const unknown = await signIn(
      initialSignInState,
      form({ email: "nessuno@blvs.it", password: "qualcosa" }),
    );
    const wrong = await signIn(
      initialSignInState,
      form({ email: valid.email, password: "sbagliata" }),
    );
    expect(unknown.status).toBe("invalid");
    expect(unknown.message).toBe("Email o password non corretti.");
    expect(wrong.message).toBe(unknown.message);
    expect(wrong.email).toBe(valid.email);
    expect(wrong).not.toHaveProperty("password");
  });

  it("campi vuoti o email non valida danno errori per campo", async () => {
    const state = await signIn(
      initialSignInState,
      form({ email: "mario", password: "" }),
    );
    expect(state.status).toBe("fieldErrors");
    expect(Object.keys(state.fieldErrors ?? {})).toEqual(["email", "password"]);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("conta i tentativi falliti in sequenza", async () => {
    let state = initialSignInState;
    state = await signIn(state, form({ email: "", password: "" }));
    state = await signIn(state, form({ email: "", password: "" }));
    expect(state.attempt).toBe(2);
  });
});

describe("signIn: limite ai tentativi", () => {
  const max = AUTH_RATE_LIMITS.login.find((r) => r.scope === "email")!.max;

  it(`dopo ${max} tentativi sospende l'accesso e scrive il tempo di attesa`, async () => {
    let state = initialSignInState;
    for (let i = 0; i < max; i++) {
      state = await signIn(
        state,
        form({ email: valid.email, password: "sbagliata" }),
      );
      expect(state.status).toBe("invalid");
    }
    signInWithPassword.mockClear();

    // Even the right password is refused while suspended.
    state = await signIn(state, form(valid));
    expect(state.status).toBe("rateLimited");
    expect(state.retryAt).toBe("2026-10-27T12:15:00.000Z");
    expect(state.message).toBe(
      "Accesso sospeso per troppi tentativi non riusciti. Riprova tra 15 minuti, dalle 13:15.",
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("a finestra scaduta si può accedere di nuovo", async () => {
    for (let i = 0; i <= max; i++)
      await signIn(
        initialSignInState,
        form({ email: valid.email, password: "x" }),
      );
    vi.setSystemTime(new Date("2026-10-27T12:15:01Z"));
    expect(await redirectedTo(signIn(initialSignInState, form(valid)))).toBe(
      "/",
    );
  });

  it("scrive «1 minuto» al singolare", async () => {
    for (let i = 0; i < max; i++)
      await signIn(
        initialSignInState,
        form({ email: valid.email, password: "x" }),
      );
    vi.setSystemTime(new Date("2026-10-27T12:14:30Z"));
    const state = await signIn(initialSignInState, form(valid));
    expect(state.message).toContain("Riprova tra 1 minuto, dalle 13:15.");
  });

  it("se il contatore non risponde rifiuta l'accesso (fail closed)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitStore({
      hit: async () => {
        throw new Error("db down");
      },
    });
    const state = await signIn(initialSignInState, form(valid));
    expect(state.status).toBe("unavailable");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("signOut: invalidazione della sessione", () => {
  it("chiude la sessione sul server e porta al login con il messaggio di uscita", async () => {
    await redirectedTo(signIn(initialSignInState, form(valid)));
    expect(await getCurrentUser()).toMatchObject({ id: "u1" });

    expect(await redirectedTo(signOut())).toBe("/accesso?uscita=1");
    expect(signOutMock).toHaveBeenCalledOnce();
    expect(await getCurrentUser()).toBeNull();
  });

  it("senza configurazione Supabase reindirizza soltanto", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(await redirectedTo(signOut())).toBe("/accesso?uscita=1");
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("se Supabase non chiude la sessione restituisce l'errore e non reindirizza", async () => {
    const error = new Error("network");
    auth.signOutError = error;
    auth.session = { sub: "u1" };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(signOut()).resolves.toEqual({ error: SIGN_OUT_ERROR_MESSAGE });
    expect(redirectMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[auth] signOut failed", error);
    expect(await getCurrentUser()).not.toBeNull();
    consoleError.mockRestore();
  });
});
