import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LiveProvider } from "@/components/live";
import type { LiveSync } from "@/lib/live/types";
import type {
  AzionePartitaAction,
  AzionePartitaState,
} from "@/lib/tappe/live-admin/state";
import type { TabelloneLive } from "@/lib/tappe/live-admin/types";
import { AdminLive } from "./admin-live";
import { appenaAvviata, inGara, liveSync, nonAvviata } from "./stories-data";

function renderLive({
  view = inGara,
  azione = vi.fn<AzionePartitaAction>(),
  punteggio = vi.fn<AzionePartitaAction>(),
  sync = liveSync,
  offline,
  initialState,
}: {
  view?: TabelloneLive;
  azione?: AzionePartitaAction;
  punteggio?: AzionePartitaAction;
  sync?: LiveSync;
  offline?: boolean;
  initialState?: AzionePartitaState;
} = {}) {
  return render(
    <LiveProvider initial={sync} connect={false}>
      <AdminLive
        view={view}
        azione={azione}
        punteggio={punteggio}
        offline={offline}
        initialState={initialState}
      />
    </LiveProvider>,
  );
}

describe("AdminLive (w-admin-live)", () => {
  it("mostra l'avanzamento, le partite in corso e tutte per girone", () => {
    renderLive();
    expect(screen.getByTestId("avanzamento")).toHaveTextContent(
      "1 di 9 partite concluse",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "11",
    );
    const inCorso = screen.getByTestId("partite-in-corso");
    const schede = within(inCorso).getAllByTestId("partita");
    expect(schede.map((s) => s.dataset.partita)).toEqual(["g1-t2", "g2-t1"]);
    // Due result: text and an icon, never colour only.
    expect(schede[0]).toHaveTextContent("Punteggio da inserire");
    expect(schede[0]).toHaveTextContent("In corso");

    const tutte = screen.getByTestId("tutte-le-partite");
    expect(
      within(tutte).getByRole("heading", { name: "Fase: Gironi" }),
    ).toBeInTheDocument();
    const gironi = within(tutte)
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(gironi).toEqual(["Girone A", "Girone B", "Girone C"]);
    const stati = within(tutte)
      .getAllByTestId("partita")
      .slice(0, 3)
      .map(
        (p) => within(p).getByText(/Da giocare|In corso|Conclusa/).textContent,
      );
    expect(stati).toEqual(["Conclusa", "In corso", "Da giocare"]);
    expect(within(tutte).getAllByTestId("partita")[0]).toHaveTextContent(
      "21-18 · 21-15",
    );
  });

  it("«Inizia» invia la partita e sposta il fuoco sull'esito", async () => {
    const user = userEvent.setup();
    const azione = vi.fn<AzionePartitaAction>(async () => ({
      status: "success",
      partitaId: "g1-t3",
      message: "Girone A · turno 3: partita in corso.",
      at: 1,
    }));
    renderLive({ azione });

    await user.click(
      screen.getByRole("button", { name: "Inizia: Girone A · turno 3" }),
    );
    await waitFor(() => expect(azione).toHaveBeenCalledTimes(1));
    const data = azione.mock.calls[0][1];
    expect(data.get("partitaId")).toBe("g1-t3");
    expect(data.get("operazione")).toBe("inizia");
    expect(data.get("categoria")).toBe("m");
    await waitFor(() =>
      expect(screen.getByTestId("admin-live-esito")).toHaveFocus(),
    );
    expect(screen.getByTestId("admin-live-esito")).toHaveTextContent(
      "Girone A · turno 3: partita in corso.",
    );
  });

  it("«Concludi» senza vincitore è disattivato e spiega perché", () => {
    renderLive();
    const [concludi] = screen.getAllByRole("button", {
      name: "Concludi: Girone A · turno 2",
    });
    expect(concludi).toHaveAttribute("aria-disabled", "true");
    expect(concludi).toHaveAccessibleDescription(
      /serve un punteggio con una squadra vincente/,
    );
  });

  it("il punteggio si scrive nel dialogo e si salva con la versione", async () => {
    const user = userEvent.setup();
    const punteggio = vi.fn<AzionePartitaAction>(async () => ({
      status: "success",
      partitaId: "g2-t1",
      message: "Girone B · turno 1: punteggio 21-19 · 21-17, partita conclusa.",
      at: 1,
    }));
    renderLive({ punteggio });

    const [apri] = screen.getAllByRole("button", {
      name: "Inserisci punteggio: Girone B · turno 1",
    });
    await user.click(apri);
    const dialog = await screen.findByRole("dialog");
    const campiSet2 = within(dialog)
      .getByRole("group", { name: "Set 2" })
      .querySelectorAll("input");
    await user.type(campiSet2[0], "21");
    await user.type(campiSet2[1], "17");
    await user.click(
      within(dialog).getByRole("button", { name: "Salva e concludi" }),
    );

    await waitFor(() => expect(punteggio).toHaveBeenCalledTimes(1));
    const data = punteggio.mock.calls[0][1];
    expect(data.get("versione")).toBe("2");
    expect(data.get("set1a")).toBe("21");
    expect(data.get("set1b")).toBe("19");
    expect(data.get("set2a")).toBe("21");
    expect(data.get("concludi")).toBe("1");
    await waitFor(() =>
      expect(screen.getByTestId("admin-live-esito")).toHaveTextContent(
        /partita conclusa/,
      ),
    );
  });

  it("mostra gli errori dei set nel dialogo", async () => {
    const user = userEvent.setup();
    const punteggio = vi.fn<AzionePartitaAction>(async () => ({
      status: "fieldErrors",
      errori: { set1: "Set 1: un set non può finire in parità." },
      message: "Il punteggio non è valido: correggi i set indicati.",
      at: 1,
    }));
    renderLive({ punteggio });
    const [apri] = screen.getAllByRole("button", {
      name: "Inserisci punteggio: Girone A · turno 2",
    });
    await user.click(apri);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salva" }));
    const errore = await within(dialog).findByText(
      "Set 1: un set non può finire in parità.",
    );
    const input = within(dialog)
      .getByRole("group", { name: "Set 1" })
      .querySelector("input");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(errore.closest("p")?.id).toBeTruthy();
  });

  it("segue le partite di un evento live più recente", () => {
    const aggiornate = inGara.partite.map((p) =>
      p.id === "g1-t3" ? { ...p, stato: "in_corso" as const } : p,
    );
    renderLive({
      sync: {
        ...liveSync,
        snapshot: {
          ...liveSync.snapshot,
          boards: [
            {
              id: "jesolo:M",
              stageId: "jesolo",
              category: "M",
              label: "Tappa 1 · Jesolo, maschile",
              change: "Girone A · turno 3: partita in corso",
              updatedAt: "2026-06-14T09:31:00.000Z",
              matches: aggiornate,
            },
          ],
        },
      },
    });
    expect(
      within(screen.getByTestId("partite-in-corso")).getAllByTestId("partita"),
    ).toHaveLength(3);
  });

  it("ignora un evento più vecchio della lettura del server", () => {
    renderLive({
      view: appenaAvviata,
      sync: {
        ...liveSync,
        snapshot: {
          ...liveSync.snapshot,
          boards: [
            {
              id: "jesolo:M",
              stageId: "jesolo",
              category: "M",
              label: "Tappa 1 · Jesolo, maschile",
              change: null,
              updatedAt: "2026-06-14T09:00:00.000Z",
              matches: inGara.partite,
            },
          ],
        },
      },
    });
    expect(screen.getByTestId("avanzamento")).toHaveTextContent(
      "0 di 9 partite concluse",
    );
  });

  it("fase non avviata: rimanda all'avvio", () => {
    renderLive({ view: nonAvviata });
    expect(screen.getByTestId("admin-live-vuota")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Vai all'avvio della fase" }),
    ).toHaveAttribute("href", "/admin/tappe/jesolo/avvio/m");
  });

  it("offline le azioni sono ferme e rimandano all'avviso", () => {
    renderLive({ offline: true });
    const inizia = screen.getByRole("button", {
      name: "Inizia: Girone A · turno 3",
    });
    expect(inizia).toHaveAttribute("aria-disabled", "true");
    expect(inizia).toHaveAccessibleDescription(/Sei offline/);
  });

  it("sessione scaduta: «Accedi di nuovo» torna qui", () => {
    renderLive({
      initialState: {
        status: "error",
        reason: "sessionExpired",
        message: "La sessione è scaduta: accedi di nuovo per continuare.",
        at: 1,
      },
    });
    expect(screen.getByTestId("admin-live-errore")).toHaveTextContent(
      "La sessione è scaduta",
    );
    expect(
      screen
        .getByRole("link", { name: "Accedi di nuovo" })
        .getAttribute("href"),
    ).toContain(encodeURIComponent("/admin/tappe/jesolo/live/m"));
  });
});
