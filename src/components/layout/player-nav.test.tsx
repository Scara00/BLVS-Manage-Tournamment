import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "@/test/media-query-mock";
import { PlayerNav } from "./player-nav";

const navigation = vi.hoisted(() => ({ pathname: "/classifica" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const signOut = vi.fn();

describe("PlayerNav", () => {
  let media: ReturnType<typeof installMatchMedia>;

  beforeEach(() => {
    navigation.pathname = "/classifica";
    media = installMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const menuButton = () => screen.getByRole("button", { name: "Menu" });
  const panel = () =>
    document.getElementById(menuButton().getAttribute("aria-controls")!)!;

  it("mostra sempre Tappe, Live, Classifica e Regole nella navigazione principale", () => {
    render(<PlayerNav signOut={signOut} />);
    const nav = screen.getByRole("navigation", { name: "Principale" });
    expect(nav).toHaveTextContent("TappeLiveClassificaRegole");
  });

  it("segna la pagina attiva con aria-current", () => {
    render(<PlayerNav signOut={signOut} />);
    expect(screen.getByRole("link", { name: "Classifica" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Tappe" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("«Profilo» è nel menu e, da desktop, accanto a «Esci»", () => {
    render(<PlayerNav signOut={signOut} />);
    const links = screen.getAllByRole("link", {
      name: "Profilo",
      hidden: true,
    });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/profilo");
  });

  it("«Impostazioni» è solo nel menu", () => {
    render(<PlayerNav signOut={signOut} />);
    const links = screen.getAllByRole("link", {
      name: "Impostazioni",
      hidden: true,
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/impostazioni");
  });

  it("apre e chiude il menu aggiornando aria-expanded", () => {
    render(<PlayerNav signOut={signOut} />);
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();

    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Esci" })).toBeVisible();

    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc chiude il menu e riporta il focus sul pulsante", () => {
    render(<PlayerNav signOut={signOut} />);
    fireEvent.click(menuButton());
    const home = screen.getByRole("link", { name: "Home" });
    home.focus();

    fireEvent.keyDown(home, { key: "Escape" });
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  it("chiude il menu quando il viewport passa al layout desktop", () => {
    render(<PlayerNav signOut={signOut} />);
    fireEvent.click(menuButton());
    expect(panel()).toBeVisible();

    act(() => media.set(true));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();

    act(() => media.set(false));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("chiude il menu al cambio di pagina", () => {
    const { rerender } = render(<PlayerNav signOut={signOut} />);
    fireEvent.click(menuButton());

    navigation.pathname = "/tappe";
    rerender(<PlayerNav signOut={signOut} />);
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Tappe" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
