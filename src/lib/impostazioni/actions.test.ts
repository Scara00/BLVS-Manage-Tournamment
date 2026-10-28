// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { url: "https://x.supabase.co", publishableKey: "pk" } as {
    url: string;
    publishableKey: string;
  } | null,
  getCurrentUser: vi.fn(),
  signInWithPassword: vi.fn(),
  verificaSignOut: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  check: vi.fn(),
  pubblica: vi.fn(),
  cookieSet: vi.fn(),
}));

class Redirect extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("@/lib/supabase/env", () => ({ readSupabaseEnv: () => mocks.env }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  checkAuthAttempt: mocks.check,
  clientIp: () => "1.2.3.4",
}));
vi.mock("@/lib/classifica-generale/pubblica", () => ({
  pubblicaClassificaGenerale: mocks.pubblica,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.verificaSignOut,
    },
  }),
}));

const { cambiaPassword, cancellaAccount } = await import("./actions");
const {
  ACCOUNT_CANCELLATO_PATH,
  IMPOSTAZIONI_MESSAGES: M,
  initialCambioPasswordState,
  initialCancellazioneState,
} = await import("./types");
const { PASSWORD_UPDATED_MESSAGE, SAME_PASSWORD_MESSAGE } =
  await import("@/lib/auth/password-reset/messages");
const { DEMO_PASSWORD_ATTUALE } = await import("@/lib/demo/impostazioni");

const supabase = {
  rpc: (...args: unknown[]) => mocks.rpc(...args),
  auth: {
    updateUser: (...args: unknown[]) => mocks.updateUser(...args),
    signOut: (...args: unknown[]) => mocks.signOut(...args),
  },
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const valida = {
  attuale: "Vecchia-password-1",
  password: "Nuova-password-22",
  conferma: "Nuova-password-22",
};

function cambia(values: Record<string, string>) {
  return cambiaPassword(initialCambioPasswordState, form(values));
}

async function cancella(conferma: string) {
  try {
    return await cancellaAccount(initialCancellazioneState, form({ conferma }));
  } catch (error) {
    if (error instanceof Redirect) return { redirect: error.to };
    throw error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env = { url: "https://x.supabase.co", publishableKey: "pk" };
  mocks.getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "luca@example.it",
    ruolo: "giocatore",
    supabase,
  });
  mocks.check.mockResolvedValue({ status: "allowed" });
  mocks.signInWithPassword.mockResolvedValue({ error: null });
  mocks.verificaSignOut.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({
    data: { tappe: [], ritirate: 0 },
    error: null,
  });
});

describe("cambiaPassword", () => {
  it("errori accanto ai campi, senza toccare Auth", async () => {
    const state = await cambia({
      attuale: "",
      password: "corta",
      conferma: "x",
    });
    expect(state).toMatchObject({
      status: "error",
      fields: {
        attuale: M.attualeMancante,
        password: expect.any(String),
        conferma: expect.any(String),
      },
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("la nuova password deve essere diversa dall'attuale", async () => {
    const state = await cambia({
      attuale: valida.password,
      password: valida.password,
      conferma: valida.password,
    });
    expect(state).toMatchObject({
      fields: { password: SAME_PASSWORD_MESSAGE },
    });
  });

  it("una password attuale sbagliata è un errore sul suo campo", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials", status: 400 },
    });
    await expect(cambia(valida)).resolves.toMatchObject({
      status: "error",
      fields: { attuale: M.attualeErrata },
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("verifica l'attuale, salva la nuova e chiude le altre sessioni", async () => {
    await expect(cambia(valida)).resolves.toEqual({
      status: "success",
      message: PASSWORD_UPDATED_MESSAGE,
    });
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "luca@example.it",
      password: valida.attuale,
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: valida.password,
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("troppi tentativi: si ferma prima di verificare", async () => {
    mocks.check.mockResolvedValue({ status: "blocked" });
    await expect(cambia(valida)).resolves.toMatchObject({
      message: M.rateLimited,
    });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("senza sessione chiede di accedere di nuovo", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(cambia(valida)).resolves.toEqual({
      status: "sessionExpired",
      message: M.sessionExpired,
    });
  });

  it("demo: accetta solo la password attuale di prova", async () => {
    mocks.env = null;
    await expect(cambia(valida)).resolves.toMatchObject({
      fields: { attuale: M.attualeErrata },
    });
    await expect(
      cambia({ ...valida, attuale: DEMO_PASSWORD_ATTUALE }),
    ).resolves.toMatchObject({ status: "success" });
  });
});

describe("cancellaAccount", () => {
  it("senza ELIMINA non cancella nulla e lo dice accanto al campo", async () => {
    await expect(cancella("")).resolves.toMatchObject({
      fields: { conferma: M.confermaMancante },
    });
    await expect(cancella("cancella")).resolves.toMatchObject({
      fields: { conferma: M.confermaErrata },
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("cancella, esce, ripubblica le classifiche e porta ad «Account cancellato»", async () => {
    mocks.rpc.mockResolvedValue({
      data: { tappe: ["t1", "t2"], ritirate: 1 },
      error: null,
    });
    await expect(cancella("ELIMINA")).resolves.toEqual({
      redirect: ACCOUNT_CANCELLATO_PATH,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("cancella_account");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.pubblica.mock.calls.map((c) => c[0])).toEqual(["t1", "t2"]);
  });

  it.each([
    ["account_admin", M.accountAdmin],
    ["tappa_in_corso", M.tappaInCorso],
  ])(
    "rifiutata (%s): l'account resta, con il motivo",
    async (hint, message) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code: "23514", hint, message: "x" },
      });
      await expect(cancella("ELIMINA")).resolves.toMatchObject({
        status: "error",
        message,
      });
      expect(mocks.signOut).not.toHaveBeenCalled();
    },
  );

  it("un errore del database non fa uscire", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(cancella("ELIMINA")).resolves.toMatchObject({
      message: M.cancellazioneFallita,
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("demo: segna il browser come uscito e porta ad «Account cancellato»", async () => {
    mocks.env = null;
    await expect(cancella("elimina")).resolves.toEqual({
      redirect: ACCOUNT_CANCELLATO_PATH,
    });
    expect(mocks.cookieSet).toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
