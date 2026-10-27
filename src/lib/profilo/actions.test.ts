// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  update: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  row: {} as Record<string, unknown>,
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: "https://blvs.example" }),
}));
vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

const { aggiornaProfilo } = await import("./actions");
const { PROFILO_MESSAGES, initialProfiloFormState } = await import("./types");

/** Just enough of the Supabase client for the action. */
const supabase = {
  from: () => ({
    select: () => ({
      eq: () => ({ single: async () => ({ data: mocks.row, error: null }) }),
    }),
    update: (values: unknown) => ({
      eq: async () => mocks.update(values),
    }),
  }),
  rpc: (...args: unknown[]) => mocks.rpc(...args),
  auth: { updateUser: (...args: unknown[]) => mocks.updateUser(...args) },
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const unchanged = {
  nome: "Marco",
  cognome: "Rossi",
  email: "marco@example.it",
  categoria: "M",
};

function salva(values: Record<string, string>) {
  return aggiornaProfilo(initialProfiloFormState, form(values));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.row = { ...unchanged };
  mocks.getCurrentUser.mockResolvedValue({
    id: "u1",
    email: "marco@example.it",
    ruolo: "giocatore",
    supabase,
  });
  mocks.rpc.mockResolvedValue({ data: "modificabile", error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
});

describe("aggiornaProfilo", () => {
  it("senza sessione restituisce sessionExpired e non scrive nulla", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(salva(unchanged)).resolves.toEqual({
      status: "sessionExpired",
      message: PROFILO_MESSAGES.sessionExpired,
    });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("segnala accanto ai campi gli errori di validazione", async () => {
    const state = await salva({ ...unchanged, nome: " ", email: "x@" });
    expect(state).toMatchObject({
      status: "error",
      fields: { nome: "Campo obbligatorio.", email: expect.any(String) },
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("salva nome e cognome senza toccare l'email", async () => {
    const state = await salva({ ...unchanged, nome: "Marcello" });
    expect(mocks.update).toHaveBeenCalledWith({
      nome: "Marcello",
      cognome: "Rossi",
      categoria: "M",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "success", emailInAttesa: null });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profilo");
  });

  it("la stessa email con maiuscole diverse non è un cambio", async () => {
    await salva({ ...unchanged, email: "Marco@Example.IT" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("una nuova email chiede la riconferma ad Auth e non sostituisce subito la precedente", async () => {
    const state = await salva({ ...unchanged, email: "Nuova@Example.it" });
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { email: "nuova@example.it" },
      { emailRedirectTo: "https://blvs.example/profilo" },
    );
    // utenti.email is never written by the action.
    expect(mocks.update).not.toHaveBeenCalled();
    expect(state).toMatchObject({
      status: "success",
      emailInAttesa: "nuova@example.it",
    });
  });

  it.each(["email_exists", "user_already_exists"])(
    "un'email già usata (%s) è un errore sul campo email",
    async (code) => {
      mocks.updateUser.mockResolvedValue({ data: {}, error: { code } });
      const state = await salva({ ...unchanged, email: "luca@example.it" });
      expect(state).toMatchObject({
        status: "error",
        fields: { email: PROFILO_MESSAGES.emailTaken },
      });
    },
  );

  it("troppe richieste di cambio email sono un errore sul campo", async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: { code: "over_email_send_rate_limit" },
    });
    const state = await salva({ ...unchanged, email: "luca@example.it" });
    expect(state).toMatchObject({
      fields: { email: PROFILO_MESSAGES.emailRateLimited },
    });
  });

  it("cambia la categoria quando è ancora modificabile", async () => {
    await salva({ ...unchanged, categoria: "F" });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ categoria: "F" }),
    );
  });

  it.each(["bloccata", "iscrizione_attiva"] as const)(
    "con la categoria %s rifiuta il cambio prima di scrivere",
    async (stato) => {
      mocks.rpc.mockResolvedValue({ data: stato, error: null });
      const state = await salva({ ...unchanged, categoria: "F" });
      expect(state).toMatchObject({
        status: "error",
        fields: { categoria: PROFILO_MESSAGES.categoria[stato] },
      });
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("a categoria bloccata senza campo categoria salva il resto", async () => {
    mocks.rpc.mockResolvedValue({ data: "bloccata", error: null });
    const { nome, email } = unchanged;
    const state = await salva({ nome, cognome: "Rossini", email });
    expect(state).toMatchObject({ status: "success" });
    expect(mocks.update).toHaveBeenCalledWith({
      nome,
      cognome: "Rossini",
      categoria: "M",
    });
  });

  it("se il trigger rifiuta il cambio di categoria l'errore va sul campo", async () => {
    mocks.update.mockResolvedValue({
      error: { code: "23514", hint: "categoria_bloccata", message: "x" },
    });
    const state = await salva({ ...unchanged, categoria: "F" });
    expect(state).toMatchObject({
      status: "error",
      fields: { categoria: PROFILO_MESSAGES.categoria.bloccata },
    });
  });
});
