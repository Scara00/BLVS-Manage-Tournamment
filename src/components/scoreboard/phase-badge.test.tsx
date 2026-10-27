import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhaseBadge } from "./phase-badge";

describe("PhaseBadge", () => {
  it.each([
    ["gold", "★", "Gold"],
    ["silver", "◆", "Silver"],
  ] as const)("%s mostra «%s %s»", (phase, icon, text) => {
    const { container } = render(<PhaseBadge phase={phase} />);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge).toHaveTextContent(`${icon}${text}`);
    expect(screen.getByText(icon)).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText(text)).toBeVisible();
  });

  it("usa solo colori piatti, senza gradienti", () => {
    const { container } = render(
      <>
        <PhaseBadge phase="gold" />
        <PhaseBadge phase="silver" />
      </>,
    );
    expect(container.innerHTML).not.toMatch(/gradient/);
  });
});
