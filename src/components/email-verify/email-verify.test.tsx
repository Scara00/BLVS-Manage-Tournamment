import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailPreview } from "./email-preview";
import { EmailVerifyScreen } from "./email-verify-screen";
import { RESENT_MESSAGE, ResendPanel } from "./resend-panel";

const T0 = new Date("2026-10-27T12:00:00Z");

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ResendPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(T0);
  });

  it("resta bloccato con il conto alla rovescia, poi si sblocca", async () => {
    render(<ResendPanel email="nuovo@example.it" initialWaitSeconds={3} />);
    const button = screen.getByRole("button", { name: "Reinvia email" });
    button.focus();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(
      "Puoi chiedere un nuovo link tra 0:03.",
    );

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(button).toHaveAccessibleDescription(
      "Puoi chiedere un nuovo link tra 0:02.",
    );

    for (let step = 0; step < 3; step++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }
    // Same node: keyboard focus is not lost when the lock ends.
    expect(screen.getByRole("button", { name: "Reinvia email" })).toBe(button);
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAccessibleDescription();
    expect(button).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Puoi chiedere un nuovo link.",
    );
  });

  it("mentre è bloccato un clic non invia nulla", async () => {
    const fetchMock = mockFetch(200, {});
    render(<ResendPanel email="nuovo@example.it" initialWaitSeconds={30} />);
    fireEvent.click(screen.getByRole("button", { name: "Reinvia email" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dopo l'invio annuncia il nuovo link e blocca per 60 secondi", async () => {
    const fetchMock = mockFetch(200, {
      inviataIl: T0.toISOString(),
      scadeIl: new Date(T0.getTime() + 3600_000).toISOString(),
      attesaSecondi: 60,
    });
    const onSent = vi.fn();
    render(<ResendPanel email="nuovo@example.it" onSent={onSent} />);
    fireEvent.click(screen.getByRole("button", { name: "Reinvia email" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(RESENT_MESSAGE),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/conferma-email/reinvio",
      expect.objectContaining({ method: "POST", body: "{}" }),
    );
    expect(onSent).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Reinvia email" }),
    ).toHaveAccessibleDescription("Puoi chiedere un nuovo link tra 1:00.");
  });

  it("se il server dice di aspettare, mostra l'attesa in un avviso", async () => {
    mockFetch(429, { error: "Attendi.", attesaSecondi: 42 });
    render(<ResendPanel email="nuovo@example.it" />);
    fireEvent.click(screen.getByRole("button", { name: "Reinvia email" }));
    expect(await screen.findByText("Attendi.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reinvia email" }),
    ).toHaveAccessibleDescription("Puoi chiedere un nuovo link tra 0:42.");
  });

  it("senza indirizzo noto lo chiede e porta il focus sull'errore", async () => {
    vi.useRealTimers();
    const fetchMock = mockFetch(200, {});
    render(<ResendPanel label="Invia un nuovo link" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Invia un nuovo link" }),
    );
    const input = screen.getByRole("textbox", { name: /Email/ });
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("EmailPreview", () => {
  it("è etichettata come anteprima e il finto pulsante non riceve il focus", async () => {
    const { container } = render(
      <>
        <button type="button">prima</button>
        <EmailPreview email="nuovo@example.it" />
        <button type="button">dopo</button>
      </>,
    );
    expect(
      screen.getByRole("figure", {
        name: "Anteprima dell'email (non interattiva)",
      }),
    ).toBeInTheDocument();
    const preview = container.querySelector("[data-slot=email-preview]")!;
    expect(
      preview.querySelectorAll("a, button, input, [tabindex], [role=button]"),
    ).toHaveLength(0);

    screen.getByRole("button", { name: "prima" }).focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "dopo" })).toHaveFocus();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("EmailVerifyScreen", () => {
  it("attesa: passo 2 di 3, indirizzo e scadenza in cifre", () => {
    render(
      <EmailVerifyScreen
        status="waiting"
        email="nuovo@example.it"
        expiresAt="2026-10-27T13:05:00Z"
      />,
    );
    expect(screen.getByText("Passo 2 di 3")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { current: "step" })).toHaveTextContent(
      "Conferma email",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Controlla la tua email" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("nuovo@example.it").length).toBeGreaterThan(0);
    expect(screen.getByText("60 minuti")).toBeInTheDocument();
    expect(screen.getByText("14:05 del 27/10/2026")).toBeInTheDocument();
  });

  it("confermata: porta al passo 3", () => {
    render(<EmailVerifyScreen status="success" />);
    expect(
      screen.getByRole("link", { name: "Continua: scegli la prima tappa" }),
    ).toHaveAttribute("href", "/tappe");
  });

  it("link scaduto: offre un nuovo invio", () => {
    render(<EmailVerifyScreen status="sessionExpired" email="a@example.it" />);
    expect(
      screen.getByRole("heading", { name: "Link scaduto o già usato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Invia un nuovo link" }),
    ).toBeInTheDocument();
  });

  it("non autorizzato: accesso negato con le strade per uscirne", () => {
    render(<EmailVerifyScreen status="permissionDenied" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Accesso negato" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Registrati" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accedi" })).toBeInTheDocument();
  });

  it("caricamento: lo annuncia", () => {
    render(<EmailVerifyScreen status="loading" />);
    expect(screen.getByRole("status")).toHaveTextContent("Caricamento…");
  });
});
