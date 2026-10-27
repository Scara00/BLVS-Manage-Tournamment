import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "@/test/media-query-mock";
import { AppShell } from "./app-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/classifica" }));

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]';

describe("AppShell", () => {
  beforeEach(() => {
    installMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("il primo elemento focalizzabile è lo skip link verso #contenuto", () => {
    const { container } = render(
      <AppShell variant="player" signOut={vi.fn()}>
        <p>Pagina</p>
      </AppShell>,
    );
    const first = container.querySelector(FOCUSABLE);
    expect(first).toHaveTextContent("Vai al contenuto");
    expect(first).toHaveAttribute("href", "#contenuto");

    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "contenuto");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("giocatore: banner, navigazione principale e main", () => {
    render(
      <AppShell variant="player" signOut={vi.fn()}>
        <p>Pagina</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Principale" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Pagina");
  });

  it("admin: banner, navigazione di amministrazione e main", () => {
    render(
      <AppShell variant="admin" signOut={vi.fn()}>
        <p>Dashboard</p>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent("Admin");
    expect(
      screen.getAllByRole("navigation", { name: "Amministrazione" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Esci" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("il footer porta all'informativa privacy con ritorno alla pagina", () => {
    render(
      <AppShell variant="player" signOut={vi.fn()}>
        <p>Pagina</p>
      </AppShell>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Informativa privacy" }),
    ).toHaveAttribute("href", "/privacy?da=%2Fclassifica");
  });
});
