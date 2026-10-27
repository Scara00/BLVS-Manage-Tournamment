import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_TAKEN_MESSAGE } from "@/lib/auth/messages";
import { CONSENT_REQUIRED_MESSAGE } from "@/lib/auth/signup";
import { SIGNUP_DRAFT_KEY } from "./signup-draft";
import {
  NETWORK_ERROR_MESSAGE,
  OFFLINE_MESSAGE,
  SignupForm,
} from "./signup-form";
import type { SubmitSignup } from "./submit-signup";

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const textbox = (name: string) =>
  screen.getByRole("textbox", { name: new RegExp(`^${name}`) });
const password = () => screen.getByLabelText(/^Password/);
const consent = () => screen.getByRole("checkbox", { name: /Ho letto/ });

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(textbox("Nome"), "Giulia");
  await user.type(textbox("Cognome"), "Colombo");
  await user.type(textbox("Email"), "giulia@example.it");
  await user.type(password(), "una-password-lunga");
  await user.click(screen.getByRole("radio", { name: "Femminile" }));
  await user.click(consent());
}

function submitButton() {
  return screen.getByRole("button", { name: /Crea account|Riprova/ });
}

describe("SignupForm", () => {
  it("chiede i dati con l'autocompletamento giusto e il consenso non spuntato", () => {
    render(<SignupForm submit={vi.fn()} />);
    expect(textbox("Nome")).toHaveAttribute("autocomplete", "given-name");
    expect(textbox("Cognome")).toHaveAttribute("autocomplete", "family-name");
    expect(textbox("Email")).toHaveAttribute("autocomplete", "email");
    expect(password()).toHaveAttribute("autocomplete", "new-password");
    expect(consent()).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("link", { name: "informativa privacy" }),
    ).toHaveAttribute("href", "/privacy?da=%2Fregistrati");
  });

  it("senza consenso non invia, mostra l'errore accanto e ci porta il focus", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<SubmitSignup>();
    render(<SignupForm submit={submit} />);
    await fillValid(user);
    await user.click(consent()); // tolto di nuovo
    await user.click(submitButton());

    expect(submit).not.toHaveBeenCalled();
    expect(screen.getByText(CONSENT_REQUIRED_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(consent()).toHaveFocus());
    expect(consent()).toHaveAccessibleDescription(
      expect.stringContaining(CONSENT_REQUIRED_MESSAGE),
    );
  });

  it("porta il focus sul primo campo con errore", async () => {
    const user = userEvent.setup();
    render(<SignupForm submit={vi.fn()} />);
    await user.type(textbox("Nome"), "Giulia");
    await user.click(submitButton());
    await waitFor(() => expect(textbox("Cognome")).toHaveFocus());
    expect(textbox("Cognome")).toHaveAttribute("aria-invalid", "true");
    expect(textbox("Nome")).not.toHaveAttribute("aria-invalid");
  });

  it("email già registrata: messaggio accanto al campo con link «Accedi»", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<SubmitSignup>().mockResolvedValue({
      kind: "invalid",
      error: EMAIL_TAKEN_MESSAGE,
      fields: { email: EMAIL_TAKEN_MESSAGE },
    });
    render(<SignupForm submit={submit} returnTo="/tappe" />);
    await fillValid(user);
    await user.click(submitButton());

    await waitFor(() => expect(textbox("Email")).toHaveFocus());
    expect(textbox("Email")).toHaveAccessibleDescription(
      expect.stringContaining(EMAIL_TAKEN_MESSAGE),
    );
    const error = screen
      .getByText(EMAIL_TAKEN_MESSAGE, { exact: false })
      .closest("[data-slot=field-error]") as HTMLElement;
    expect(within(error).getByRole("link", { name: "Accedi" })).toHaveAttribute(
      "href",
      "/accesso?da=%2Ftappe",
    );
    expect(textbox("Nome")).toHaveValue("Giulia");
  });

  it("dopo la creazione l'utente è connesso e torna alla pagina di origine", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<SubmitSignup>().mockResolvedValue({
      kind: "ok",
      connesso: true,
      messaggio: "ok",
    });
    render(<SignupForm submit={submit} returnTo="/tappe" />);
    await fillValid(user);
    await user.click(submitButton());

    expect(submit).toHaveBeenCalledWith({
      nome: "Giulia",
      cognome: "Colombo",
      email: "giulia@example.it",
      password: "una-password-lunga",
      categoria: "F",
      consensoPrivacy: true,
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/tappe"));
    expect(refresh).toHaveBeenCalled();
    expect(sessionStorage.getItem(SIGNUP_DRAFT_KEY)).toBeNull();
  });

  it("errore di rete: avvisa, offre «Riprova» e tiene i dati", async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn<SubmitSignup>()
      .mockResolvedValueOnce({ kind: "network" })
      .mockResolvedValueOnce({ kind: "ok", connesso: true, messaggio: "ok" });
    render(<SignupForm submit={submit} />);
    await fillValid(user);
    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      NETWORK_ERROR_MESSAGE,
    );
    expect(password()).toHaveValue("una-password-lunga");
    expect(textbox("Email")).toHaveValue("giulia@example.it");
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("offline: avvisa, blocca l'invio e non perde i dati", async () => {
    const user = userEvent.setup();
    const submit = vi.fn<SubmitSignup>();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<SignupForm submit={submit} />);
    await fillValid(user);

    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(OFFLINE_MESSAGE);
    expect(submitButton()).toHaveAttribute("aria-disabled", "true");
    await user.click(submitButton());
    expect(submit).not.toHaveBeenCalled();
    expect(textbox("Cognome")).toHaveValue("Colombo");
  });

  it("ritrova i dati tornando dall'informativa, ma mai la password", async () => {
    const user = userEvent.setup();
    const first = render(<SignupForm submit={vi.fn()} />);
    await fillValid(user);
    expect(sessionStorage.getItem(SIGNUP_DRAFT_KEY)).not.toContain(
      "una-password-lunga",
    );
    first.unmount();

    render(<SignupForm submit={vi.fn()} />);
    expect(textbox("Nome")).toHaveValue("Giulia");
    expect(textbox("Email")).toHaveValue("giulia@example.it");
    expect(screen.getByRole("radio", { name: "Femminile" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(consent()).toHaveAttribute("aria-checked", "true");
    expect(password()).toHaveValue("");
  });

  it("aggiorna l'anteprima del tabellone mentre si scrive, nascosta ai lettori di schermo", async () => {
    const user = userEvent.setup();
    render(<SignupForm submit={vi.fn()} />);
    const name = screen.getByTestId("signup-board-name");
    expect(name.closest("[aria-hidden=true]")).not.toBeNull();
    await user.type(textbox("Cognome"), "Colombo");
    await user.type(textbox("Nome"), "giulia");
    expect(name).toHaveTextContent("COLOMBO G.");
  });
});
