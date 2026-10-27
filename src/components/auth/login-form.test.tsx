import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SignInState } from "@/lib/auth/sign-in-state";
import { initialSignInState } from "@/lib/auth/sign-in-state";
import { readDraft, saveDraft } from "@/lib/drafts/drafts";

const params = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => params.current,
}));

const { LoginForm } = await import("./login-form");
const { LoginFormView } = await import("./login-form-view");
const { SessionExpired } = await import("./session-expired");

const noop = async () => initialSignInState;
const noopSignOut = async () => ({ error: null });

beforeEach(() => {
  params.current = new URLSearchParams();
  localStorage.clear();
});

describe("LoginFormView", () => {
  it("usa i suggerimenti di compilazione e non blocca l'incolla", () => {
    render(<LoginFormView state={initialSignInState} />);
    const email = screen.getByLabelText(/^Email/);
    const password = screen.getByLabelText(/^Password/);
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(email).toHaveAttribute("type", "email");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    expect(password).toHaveAttribute("type", "password");

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    password.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(false);
  });

  it("dopo un errore di campo porta il focus sul primo campo non valido", () => {
    render(
      <LoginFormView
        state={{
          status: "fieldErrors",
          fieldErrors: { email: "Inserisci un'email valida." },
          attempt: 1,
        }}
      />,
    );
    const email = screen.getByLabelText(/^Email/);
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveFocus();
  });

  it("con credenziali errate porta il focus sul messaggio generico", () => {
    const state: SignInState = {
      status: "invalid",
      message: "Email o password non corretti.",
      email: "mario@blvs.it",
      attempt: 1,
    };
    const { rerender } = render(<LoginFormView state={state} />);
    const error = screen.getByText("Email o password non corretti.");
    expect(error.closest("[data-slot=login-error]")).toHaveFocus();
    expect(screen.getByLabelText(/^Email/)).toHaveValue("mario@blvs.it");

    // Same message on the next attempt: focus moves back to it.
    screen.getByLabelText(/^Password/).focus();
    rerender(<LoginFormView state={{ ...state, attempt: 2 }} />);
    expect(error.closest("[data-slot=login-error]")).toHaveFocus();
  });

  describe("accesso sospeso", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-27T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("scrive il tempo di attesa e riattiva il pulsante allo scadere", () => {
      render(
        <LoginFormView
          state={{
            status: "rateLimited",
            message:
              "Accesso sospeso per troppi tentativi non riusciti. Riprova tra 2 minuti, dalle 13:02.",
            retryAt: "2026-10-27T12:02:00.000Z",
            attempt: 6,
          }}
        />,
      );
      expect(screen.getByText("2 minuti")).toHaveClass("font-mono");
      expect(screen.getByText("13:02").tagName).toBe("TIME");
      let submit = screen.getByRole("button", { name: "Accedi" });
      expect(submit).toHaveAttribute("aria-disabled", "true");

      act(() => vi.advanceTimersByTime(2 * 60_000));
      // Without the reason the button is no longer wrapped: query it again.
      submit = screen.getByRole("button", { name: "Accedi" });
      expect(submit).not.toHaveAttribute("aria-disabled", "true");
      expect(submit).not.toHaveAttribute("data-inactive");
      expect(
        screen.getByText("L'attesa è finita: puoi riprovare ad accedere."),
      ).toBeInTheDocument();
    });
  });

  it("permissionDenied offre la home e l'uscita", () => {
    render(
      <LoginFormView
        state={{
          status: "permissionDenied",
          message: "Riservata.",
          attempt: 1,
        }}
        signOutAction={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "Vai alla home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("button", { name: "Esci e cambia account" }),
    ).toBeInTheDocument();
  });

  it("il pulsante mostra/nascondi password è un interruttore", () => {
    render(<LoginFormView state={initialSignInState} />);
    const toggle = screen.getByRole("button", { name: "Mostra password" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("type", "text");
  });
});

describe("LoginForm", () => {
  it("passa all'azione solo un percorso di ritorno interno", () => {
    params.current = new URLSearchParams({
      da: "/admin/tappe",
      motivo: "scaduta",
    });
    const { container } = render(
      <LoginForm signIn={noop} signOut={noopSignOut} />,
    );
    expect(container.querySelector("input[name=da]")).toHaveValue(
      "/admin/tappe",
    );
    expect(screen.getByText("La sessione è scaduta.")).toBeInTheDocument();
    expect(screen.getByText("Admin · Tappe")).toBeInTheDocument();
  });

  it("ignora un da esterno", () => {
    params.current = new URLSearchParams({ da: "//evil.example" });
    const { container } = render(
      <LoginForm signIn={noop} signOut={noopSignOut} />,
    );
    expect(container.querySelector("input[name=da]")).toBeNull();
  });

  it("dopo «Esci» conferma l'uscita ed elimina le bozze locali", () => {
    saveDraft({
      id: "a",
      label: "Iscrizione",
      path: "/tappe",
      savedAt: "2026-10-27T10:00:00.000Z",
      values: { nome: "Mario" },
    });
    params.current = new URLSearchParams({ uscita: "1" });
    render(<LoginForm signIn={noop} signOut={noopSignOut} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sei uscito dall'account. Le bozze salvate su questo dispositivo sono state eliminate.",
    );
    expect(readDraft("a")).toBeNull();
  });
});

describe("SessionExpired", () => {
  it("dice dove si torna, cosa è salvato e quali bozze restano", () => {
    saveDraft({
      id: "iscrizione",
      label: "Iscrizione alla tappa di Rimini",
      path: "/tappe",
      savedAt: "2026-10-27T10:00:00.000Z",
      values: { nome: "Mario" },
    });
    params.current = new URLSearchParams({ da: "/classifica" });
    render(<SessionExpired />);

    expect(
      screen.getByRole("heading", { name: "Dove torni" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Classifica")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cosa è salvato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iscrizione alla tappa di Rimini" }),
    ).toHaveAttribute("href", "/tappe");
    expect(
      screen.getByRole("link", { name: /Accedi di nuovo/ }),
    ).toHaveAttribute("href", "/accesso?da=%2Fclassifica&motivo=scaduta");
  });

  it("senza bozze lo dice", () => {
    render(<SessionExpired />);
    expect(
      screen.getByText(/Nessuna bozza su questo dispositivo/),
    ).toBeInTheDocument();
  });
});
