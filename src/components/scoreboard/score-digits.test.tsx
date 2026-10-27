import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreDigits } from "./score-digits";

describe("ScoreDigits", () => {
  it("mette «°» nello stesso nodo di testo del numero", () => {
    const { container } = render(<ScoreDigits value={1} ordinal />);
    const visible = container.querySelector('[aria-hidden="true"]')!;
    expect(visible.childNodes).toHaveLength(1);
    expect(visible.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(visible.textContent).toBe("1°");
  });

  it("legge l'ordinale come «N° posto»", () => {
    render(<ScoreDigits value={3} ordinal />);
    expect(screen.getByText("3° posto")).toHaveClass("sr-only");
  });

  it("ha un solo testo accessibile", () => {
    const { container } = render(<ScoreDigits value={21} label="21 punti" />);
    expect(screen.getByText("21 punti")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(
      "21",
    );
  });

  it("usa cifre monospazio, larghezza fissa e niente a capo", () => {
    const { container } = render(<ScoreDigits value={7} digits={2} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("font-mono", "tabular-nums", "whitespace-nowrap");
    expect(root.style.minWidth).toBe("2ch");
  });

  it.each([
    ["default", "text-primary"],
    ["inverse", "bg-primary"],
    ["tape", "bg-tape"],
  ] as const)("tono %s", (tone, cls) => {
    const { container } = render(<ScoreDigits value={1} tone={tone} />);
    expect(container.firstElementChild).toHaveClass(cls);
  });
});
