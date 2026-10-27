import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMatchMedia } from "@/test/media-query-mock";
import { AdminSidebar } from "./admin-sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/iscrizioni" }));

describe("AdminSidebar", () => {
  let media: ReturnType<typeof installMatchMedia>;

  beforeEach(() => {
    media = installMatchMedia(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const menuButton = () =>
    screen.getByRole("button", { name: "Menu amministrazione" });

  it("la colonna nera appare solo da md, il menu compatto solo sotto", () => {
    const { container } = render(<AdminSidebar />);
    const aside = container.querySelector("aside")!;
    expect(aside).toHaveClass("hidden", "md:flex", "bg-primary");
    expect(menuButton().parentElement).toHaveClass("md:hidden");
  });

  it("elenca Dashboard, Tappe, Iscrizioni e Giocatori con la voce attiva", () => {
    const { container } = render(<AdminSidebar />);
    const desktop = within(container.querySelector("aside")!);
    expect(desktop.getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Dashboard",
      "Tappe",
      "Iscrizioni",
      "Giocatori",
    ]);
    expect(desktop.getByRole("link", { name: "Iscrizioni" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      desktop.getByRole("link", { name: "Dashboard" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("apre il menu compatto, Esc lo chiude e riporta il focus", () => {
    render(<AdminSidebar />);
    const panel = document.getElementById(
      menuButton().getAttribute("aria-controls")!,
    )!;
    expect(panel).not.toBeVisible();

    fireEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(panel).toBeVisible();

    fireEvent.keyDown(within(panel).getByRole("link", { name: "Tappe" }), {
      key: "Escape",
    });
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  it("chiude il menu compatto al passaggio al layout desktop", () => {
    render(<AdminSidebar />);
    fireEvent.click(menuButton());
    act(() => media.set(true));
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});
