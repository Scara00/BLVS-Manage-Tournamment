import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { readDraft } from "@/lib/drafts/drafts";
import { useFormDraft } from "@/lib/drafts/use-form-draft";
import { initialSignOutState } from "@/lib/auth/sign-out-state";
import { AdminSessionWatcher } from "./admin-session-watcher";

const nav = vi.hoisted(() => ({ pathname: "/admin/tappe" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

const IDLE = 600;
const WARNING = 120;
const signOut = vi.fn(async () => initialSignOutState);

function FixtureForm() {
  const ref = useRef<HTMLFormElement>(null);
  useFormDraft(ref, {
    id: "admin-tappa",
    label: "Nuova tappa",
    path: "/admin/tappe",
  });
  return (
    <form ref={ref}>
      <label>
        Nome tappa
        <input name="nome" />
      </label>
    </form>
  );
}

function renderWatcher(
  props: Partial<React.ComponentProps<typeof AdminSessionWatcher>> = {},
) {
  const redirect = vi.fn();
  const view = render(
    <ToastProvider>
      <FixtureForm />
      <AdminSessionWatcher
        enforced={false}
        idleSeconds={IDLE}
        warningSeconds={WARNING}
        signOut={signOut}
        redirect={redirect}
        {...props}
      />
      <Toaster />
    </ToastProvider>,
  );
  return { ...view, redirect };
}

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function setup() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "Date",
      "performance",
    ],
  });
  // Lets Testing Library's waitFor/findBy advance the fake clock.
  vi.stubGlobal("jest", {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  });
  vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
  localStorage.clear();
  window.history.replaceState(null, "", "/admin/tappe?stato=aperte");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AdminSessionWatcher (demo, senza Supabase)", () => {
  it("2 minuti prima della scadenza apre l'alertdialog con il focus su «Prolunga sessione»", async () => {
    renderWatcher();
    await advance((IDLE - WARNING) * 1000 - 1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await advance(1);
    const dialog = await screen.findByRole("alertdialog", {
      name: "La sessione sta per scadere",
    });
    expect(dialog).toHaveAccessibleDescription(/si chiude tra 2 minuti\./);
    expect(screen.getByTestId("admin-session-countdown")).toHaveTextContent(
      "2:00",
    );
    expect(screen.getByRole("button", { name: "Esci" })).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Prolunga sessione" }),
      ).toHaveFocus(),
    );

    await advance(61_000);
    expect(screen.getByTestId("admin-session-countdown")).toHaveTextContent(
      "0:59",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Manca meno di un minuto",
    );
  });

  it("prolungando non ricarica la pagina, i valori restano e il focus torna al campo", async () => {
    const user = setup();
    renderWatcher();
    const nome = screen.getByLabelText("Nome tappa");
    await user.type(nome, "Rimini");
    await advance((IDLE - WARNING) * 1000);
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Prolunga sessione" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(nome).toHaveValue("Rimini");
    expect(window.location.pathname).toBe("/admin/tappe");
    expect(await screen.findByText("Sessione prolungata")).toBeInTheDocument();
    expect(
      screen.getByText("Resti connesso fino alle 11:18."),
    ).toBeInTheDocument();
    await waitFor(() => expect(nome).toHaveFocus());

    // The countdown started again from the full idle time.
    await advance((IDLE - WARNING) * 1000 - 1_000);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("Esc prolunga la sessione", async () => {
    const user = setup();
    renderWatcher();
    await advance((IDLE - WARNING) * 1000);
    await screen.findByRole("alertdialog");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Prolunga sessione" }),
      ).toHaveFocus(),
    );

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(await screen.findByText("Sessione prolungata")).toBeInTheDocument();
  });

  it("alla scadenza salva subito le bozze e porta a «Sessione scaduta» con la pagina di ritorno", async () => {
    const user = setup();
    const { redirect } = renderWatcher();
    await advance(IDLE * 1000 - 5_000);
    // Typed in the last seconds: still inside the 500 ms save delay.
    await user.type(screen.getByLabelText("Nome tappa"), "Jesolo");
    await advance(4_900);
    expect(readDraft("admin-tappa")?.values).toEqual({ nome: "Jesolo" });
    localStorage.clear();
    await user.type(screen.getByLabelText("Nome tappa"), "!");
    expect(readDraft("admin-tappa")).toBeNull();

    await advance(100);

    expect(readDraft("admin-tappa")?.values).toEqual({ nome: "Jesolo!" });
    expect(
      screen.getByRole("alertdialog", { name: "Sessione scaduta" }),
    ).toBeInTheDocument();
    await advance(0);
    expect(redirect).toHaveBeenCalledWith(
      "/sessione-scaduta?da=%2Fadmin%2Ftappe%3Fstato%3Daperte",
    );
  });

  it("cambiare pagina admin conta come attività", async () => {
    const view = renderWatcher();
    await advance((IDLE - WARNING) * 1000 - 10_000);
    nav.pathname = "/admin/iscrizioni";
    view.rerender(
      <ToastProvider>
        <FixtureForm />
        <AdminSessionWatcher
          enforced={false}
          idleSeconds={IDLE}
          warningSeconds={WARNING}
          signOut={signOut}
          redirect={view.redirect}
        />
      </ToastProvider>,
    );
    await advance(20_000);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    nav.pathname = "/admin/tappe";
  });
});

describe("AdminSessionWatcher (sessione verificata dal server)", () => {
  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }

  it("chiede al server il tempo rimasto e prolunga con una POST", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? json({ scadeTraSecondi: IDLE, scadeAlle: "2026-10-27T09:30:05Z" })
        : json({ scadeTraSecondi: 125, scadeAlle: "2026-10-27T10:02:05Z" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = setup();
    renderWatcher({ enforced: true });

    await advance(4_999);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await advance(1);
    await screen.findByRole("alertdialog");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/sessione", {
      cache: "no-store",
    });

    await user.click(screen.getByRole("button", { name: "Prolunga sessione" }));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/sessione", {
      method: "POST",
      cache: "no-store",
    });
    expect(
      await screen.findByText("Resti connesso fino alle 10:30."),
    ).toBeInTheDocument();
  });

  it("se il prolungamento non riesce lo dice e l'avviso resta aperto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === "POST"
          ? json({ error: "boom" }, 500)
          : json({ scadeTraSecondi: 100, scadeAlle: "x" }),
      ),
    );
    const user = setup();
    renderWatcher({ enforced: true });
    await advance(0);
    await screen.findByRole("alertdialog");

    await user.click(screen.getByRole("button", { name: "Prolunga sessione" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Non è stato possibile prolungare la sessione. Riprova.",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("alla scadenza chiede conferma al server: con 401 chiude", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ scadeTraSecondi: 130, scadeAlle: "x" }))
      .mockResolvedValueOnce(json({ error: "scaduta" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    const { redirect } = renderWatcher({ enforced: true });

    await advance(130_000);
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(redirect).toHaveBeenCalledWith(
      "/sessione-scaduta?da=%2Fadmin%2Ftappe%3Fstato%3Daperte",
    );
  });

  it("senza una sessione admin (403 al primo controllo) non mostra nulla", async () => {
    const fetchMock = vi.fn(async () =>
      json({ error: "Accesso negato." }, 403),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { redirect } = renderWatcher({ enforced: true });
    await advance(IDLE * 2000);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
