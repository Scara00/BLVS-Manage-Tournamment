import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PRIVACY_POLICY_VERSION,
  privacySections,
} from "@/lib/legal/privacy-policy";
import { mockMatchMedia } from "@/test/match-media";
import { PrivacyPolicy } from "./privacy-policy";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("da=%2Fclassifica"),
}));

describe("PrivacyPolicy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("espone numero e data della versione come dato", () => {
    mockMatchMedia(true);
    render(<PrivacyPolicy />);
    const version = screen.getByTestId("privacy-version");
    expect(version).toHaveAttribute(
      "data-version",
      PRIVACY_POLICY_VERSION.number,
    );
    expect(version).toHaveAttribute(
      "data-version-date",
      PRIVACY_POLICY_VERSION.date,
    );
    expect(version).toHaveTextContent(
      `Versione ${PRIVACY_POLICY_VERSION.number}`,
    );
    expect(version.querySelector("time")).toHaveAttribute(
      "datetime",
      PRIVACY_POLICY_VERSION.date,
    );
  });

  it("l'indice elenca tutte le sezioni con una sola voce attiva", () => {
    mockMatchMedia(true);
    render(<PrivacyPolicy />);
    const index = screen.getByRole("navigation", { name: "Indice" });
    const links = within(index).getAllByRole("link");
    expect(links).toHaveLength(privacySections.length);
    privacySections.forEach((section, i) => {
      expect(links[i]).toHaveAccessibleName(section.title);
      expect(links[i]).toHaveAttribute("href", `#${section.id}`);
      expect(
        screen.getByRole("region", { name: section.title }),
      ).toHaveAttribute("id", section.id);
    });
    // jsdom has no layout: which one is current is covered by
    // use-active-section.test.tsx and the e2e spec.
    expect(links.filter((l) => l.getAttribute("aria-current")).length).toBe(1);
  });

  it("mette in evidenza che l'email non compare mai", () => {
    mockMatchMedia(true);
    render(<PrivacyPolicy />);
    expect(screen.getByText(/L'email non compare mai/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "In breve" })).toHaveTextContent(
      "sparisci dalle classifiche",
    );
  });

  it("il pulsante in fondo torna alla pagina di origine", () => {
    mockMatchMedia(true);
    render(<PrivacyPolicy />);
    expect(
      screen.getByRole("link", { name: "Torna alla pagina precedente" }),
    ).toHaveAttribute("href", "/classifica");
  });

  it("riga d'esempio: con movimento ridotto mostra subito i valori finali", () => {
    mockMatchMedia(true);
    render(<PrivacyPolicy />);
    const table = screen.getByRole("table", {
      name: "Esempio di riga in classifica",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Pos.", "Coppia", "Punti"]);
    const row = within(table).getByRole("row", { name: /Rossi/ });
    expect(row).toHaveTextContent("3");
    expect(row).toHaveTextContent("385");
    expect(table.querySelector("[class*='animate-flip']")).toBeNull();
  });

  it("riga d'esempio: senza riduzione le palette girano una sola volta", async () => {
    mockMatchMedia(false);
    const { rerender } = render(<PrivacyPolicy />);
    const table = screen.getByRole("table");
    const flipping = () => table.querySelectorAll("[class*='animate-flip']");
    await waitFor(() => expect(flipping().length).toBeGreaterThan(0));
    // The sr-only labels always carry the final values.
    expect(table).toHaveTextContent("385");
    for (const el of flipping()) {
      fireEvent(el, new Event("webkitAnimationEnd", { bubbles: true }));
    }
    await waitFor(() => expect(flipping()).toHaveLength(0));
    rerender(<PrivacyPolicy />);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(flipping()).toHaveLength(0);
  });
});
