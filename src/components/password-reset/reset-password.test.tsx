import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { ResetPasswordFlow, type SaveNewPassword } from "./reset-password-form";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string }) => (
    <a href={href} {...props} />
  ),
}));

const GOOD = "Spiaggia-2026";

function setup(save: SaveNewPassword, tokenHash: string | null = "hash") {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <ResetPasswordFlow tokenHash={tokenHash} save={save} />
      <Toaster />
    </ToastProvider>,
  );
  const password = screen.getByLabelText(/^Nuova password/);
  const confirmation = screen.getByLabelText(/^Ripeti la nuova password/);
  return { user, password, confirmation };
}

beforeEach(() => {
  replace.mockReset();
});

describe("w-reset", () => {
  it("i due campi usano autocomplete new-password e i requisiti hanno l'esito a testo", async () => {
    const { user, password, confirmation } = setup(vi.fn());
    expect(password).toHaveAttribute("autocomplete", "new-password");
    expect(confirmation).toHaveAttribute("autocomplete", "new-password");
    expect(password).toHaveAccessibleDescription(/Requisiti della password/);

    const list = screen.getByRole("list");
    const item = (name: RegExp) =>
      within(list).getByText(name).closest("li") as HTMLElement;
    expect(item(/Almeno un numero/)).toHaveTextContent(
      /Almeno un numero: manca/,
    );

    await user.type(password, "abc1");
    expect(item(/Almeno un numero/)).toHaveTextContent(/: fatto/);
    expect(item(/Da 10 a 72/)).toHaveTextContent(/: manca/);
    await user.type(confirmation, "abc1");
    expect(item(/coincidono/)).toHaveTextContent(/: fatto/);
  });

  it("spiega sotto il pulsante che chiude le altre sessioni", () => {
    setup(vi.fn());
    expect(
      screen.getByRole("button", { name: "Salva la nuova password" }),
    ).toHaveAccessibleDescription(
      /chiudiamo le sessioni aperte sugli altri dispositivi/,
    );
  });

  it("requisiti non rispettati: errore sul campo con focus, nessun invio", async () => {
    const save = vi.fn();
    const { user, password } = setup(save);
    await user.type(password, "corta");
    await user.click(
      screen.getByRole("button", { name: "Salva la nuova password" }),
    );
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(save).not.toHaveBeenCalled();
  });

  it("salva con il token, conferma con un avviso e va alla home", async () => {
    const save = vi.fn<SaveNewPassword>().mockResolvedValue({
      kind: "ok",
      data: {
        messaggio: "Password aggiornata. Chiuse le altre.",
        altreSessioniChiuse: true,
      },
    });
    const { user, password, confirmation } = setup(save);
    await user.type(password, GOOD);
    await user.type(confirmation, GOOD);
    await user.keyboard("{Enter}");

    expect(save).toHaveBeenCalledWith({
      tokenHash: "hash",
      password: GOOD,
      conferma: GOOD,
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(
      await screen.findByText("Password aggiornata. Chiuse le altre.", {
        selector: "[data-slot=toast] *",
      }),
    ).toBeInTheDocument();
  });

  it("link scaduto o già usato: stato dedicato con richiesta di un nuovo link", async () => {
    const save = vi.fn<SaveNewPassword>().mockResolvedValue({
      kind: "link-invalid",
      message: "Scaduto",
    });
    const { user, password, confirmation } = setup(save);
    await user.type(password, GOOD);
    await user.type(confirmation, GOOD);
    await user.keyboard("{Enter}");

    const heading = await screen.findByRole("heading", {
      level: 1,
      name: "Link scaduto o già usato",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(
      screen.getByRole("link", { name: "Chiedi un nuovo link" }),
    ).toHaveAttribute("href", "/password-dimenticata?motivo=link-scaduto");
  });

  it("senza token mostra subito lo stato di link non valido", () => {
    render(
      <ToastProvider>
        <ResetPasswordFlow tokenHash={null} />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "Link scaduto o già usato" }),
    ).toBeInTheDocument();
  });

  it("dopo un errore con la sessione di recupero riprova senza token", async () => {
    const save = vi
      .fn<SaveNewPassword>()
      .mockResolvedValueOnce({
        kind: "fields",
        message: "Controlla",
        fields: { password: "Scegli una password diversa da quella attuale." },
        body: { sessioneRecupero: true },
      })
      .mockResolvedValueOnce({
        kind: "ok",
        data: { messaggio: "ok", altreSessioniChiuse: true },
      });
    const { user, password, confirmation } = setup(save);
    await user.type(password, GOOD);
    await user.type(confirmation, GOOD);
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(password).toHaveAccessibleDescription(/diversa da quella attuale/),
    );

    await user.clear(password);
    await user.type(password, "Spiaggia-2027");
    await user.clear(confirmation);
    await user.type(confirmation, "Spiaggia-2027");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1][0]).toEqual({
      tokenHash: undefined,
      password: "Spiaggia-2027",
      conferma: "Spiaggia-2027",
    });
  });
});
