// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  admin: true,
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () =>
    mocks.admin ? { auth: { admin: { deleteUser: mocks.deleteUser } } } : null,
}));

const { cancellaAccount } = await import("./actions");
const { CANCELLA_ACCOUNT_MESSAGES, initialCancellaAccountState } =
  await import("./types");

const supabase = {
  rpc: (...args: unknown[]) => mocks.rpc(...args),
  auth: { signOut: (...args: unknown[]) => mocks.signOut(...args) },
};

function form(conferma = "1") {
  const data = new FormData();
  data.set("conferma", conferma);
  return data;
}

const run = (data = form()) =>
  cancellaAccount(initialCancellaAccountState, data);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.admin = true;
  mocks.getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "luca@example.it",
    ruolo: "giocatore",
    supabase,
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.deleteUser.mockResolvedValue({ data: {}, error: null });
});

describe("cancellaAccount", () => {
  it("senza conferma non tocca nulla", async () => {
    expect(await run(form(""))).toEqual({
      status: "error",
      message: CANCELLA_ACCOUNT_MESSAGES.conferma,
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("senza sessione chiede di accedere di nuovo", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await run()).status).toBe("sessionExpired");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("anonimizza, esce, elimina il login e va all'accesso con l'avviso", async () => {
    await expect(run()).rejects.toThrow(
      "NEXT_REDIRECT /accesso?motivo=account_cancellato",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("cancella_account");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.deleteUser).toHaveBeenCalledWith("u1");
    // Data first, login after: a failure in between leaves no personal data.
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteUser.mock.invocationCallOrder[0],
    );
  });

  it("senza chiave segreta l'account resta comunque anonimo", async () => {
    mocks.admin = false;
    await expect(run()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it.each([
    ["tappa_in_corso", CANCELLA_ACCOUNT_MESSAGES.tappaInCorso],
    ["account_admin", CANCELLA_ACCOUNT_MESSAGES.accountAdmin],
    [undefined, CANCELLA_ACCOUNT_MESSAGES.failed],
  ])("rifiuto %s: messaggio a testo, nessuna uscita", async (hint, message) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: hint ? "23514" : "XX000", hint, message: "no" },
    });
    expect(await run()).toEqual({ status: "error", message });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
