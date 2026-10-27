import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForbiddenContent } from "./forbidden-content";
import { NotFoundContent } from "./not-found-content";
import { ServiceUnavailable } from "./service-unavailable";

function definitions(list: HTMLElement) {
  return within(list)
    .getAllByRole("term")
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? "",
    ]);
}

/** The flaps carry the code visually only: hidden and never animated. */
function expectStaticHiddenCode(container: HTMLElement, code: string) {
  const flaps = container.querySelector("[data-slot=flip-digits]");
  expect(flaps?.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(flaps?.textContent).toContain(code);
  expect(container.querySelector("[class*='animate-']")).toBeNull();
}

describe("ForbiddenContent (403)", () => {
  it("mostra ruolo attuale e ruolo richiesto nel mini tabellone", () => {
    const { container } = render(<ForbiddenContent />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Accesso negato" }),
    ).toBeInTheDocument();
    expect(definitions(screen.getByLabelText("Ruoli"))).toEqual([
      ["Il tuo ruolo", "Giocatore"],
      ["Richiesto", "Admin"],
    ]);
    expectStaticHiddenCode(container, "403");
  });

  it("dice cosa fare e offre le uscite", () => {
    render(<ForbiddenContent />);
    expect(
      screen.getByText(/chiedi a un amministratore del circuito/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Torna alla home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Vai alle tappe" }),
    ).toHaveAttribute("href", "/tappe");
  });
});

describe("NotFoundContent (404)", () => {
  it("mostra FUORI CAMPO · RIENTRA DALLE TAPPE e porta alle tappe", () => {
    const { container } = render(<NotFoundContent />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Pagina non trovata" }),
    ).toBeInTheDocument();
    const banner = container.querySelector("[data-slot=error-banner]");
    expect(banner).toHaveTextContent("Fuori campo · Rientra dalle tappe");
    expect(banner).toHaveClass("uppercase");
    expect(
      screen.getByRole("link", { name: "Vai alle tappe" }),
    ).toHaveAttribute("href", "/tappe");
    expectStaticHiddenCode(container, "404");
  });

  it("nell'area admin punta alle tappe admin", () => {
    render(<NotFoundContent stagesHref="/admin/tappe" homeHref="/admin" />);
    expect(
      screen.getByRole("link", { name: "Vai alle tappe" }),
    ).toHaveAttribute("href", "/admin/tappe");
  });

  it("imposta il titolo del documento quando richiesto", () => {
    render(<NotFoundContent documentTitle="Pagina non trovata" />);
    expect(document.title).toBe("Pagina non trovata · BLVS");
  });
});

describe("ServiceUnavailable (503)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const at = new Date("2026-06-14T08:05:09Z");

  it("dice cosa non è partito, con codice e orario", () => {
    const { container } = render(
      <ServiceUnavailable
        what="L'iscrizione alla tappa"
        code="ERR-503-ISCR"
        at={at}
        onRetry={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Servizio non disponibile",
      }),
    ).toBeInTheDocument();
    expect(definitions(screen.getByLabelText("Dettagli dell'errore"))).toEqual([
      ["Non è partito", "L'iscrizione alla tappa"],
      ["Codice", "ERR-503-ISCR"],
      // Europe/Rome, CEST.
      ["Orario", "14/06/26, 10:05:09"],
    ]);
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-06-14T08:05:09.000Z",
    );
    expectStaticHiddenCode(container, "503");
  });

  it("mette Riprova, Torna al modulo e Home nella stessa riga", () => {
    const onRetry = vi.fn();
    render(
      <ServiceUnavailable what="X" code="ERR-503" at={at} onRetry={onRetry} />,
    );
    const retry = screen.getByRole("button", { name: "Riprova" });
    const form = screen.getByRole("link", { name: "Torna al modulo" });
    const home = screen.getByRole("link", { name: "Home" });
    expect(form).toHaveAttribute("href", "/tappe");
    expect(home).toHaveAttribute("href", "/");
    expect(retry.parentElement).toBe(form.parentElement);
    expect(home.parentElement).toBe(form.parentElement);
    expect(form.parentElement).toHaveClass("flex", "flex-wrap");

    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("in caricamento Riprova resta focalizzabile e non riparte", () => {
    const onRetry = vi.fn();
    render(
      <ServiceUnavailable
        what="X"
        code="ERR-503"
        at={at}
        onRetry={onRetry}
        retrying
      />,
    );
    const retry = screen.getByRole("button", { name: /Riprova/ });
    expect(retry).toHaveAttribute("aria-busy", "true");
    fireEvent.click(retry);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
