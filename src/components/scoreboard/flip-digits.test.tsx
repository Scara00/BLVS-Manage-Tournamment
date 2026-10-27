import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import { FlipDigits } from "./flip-digits";

/** Text nodes a screen reader can reach (outside aria-hidden). */
function accessibleTexts(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement?.closest('[aria-hidden="true"]')) {
      if (node.textContent?.trim()) out.push(node.textContent);
    }
  }
  return out;
}

const hidden = (c: HTMLElement) =>
  c.querySelector('[aria-hidden="true"]') as HTMLElement;

describe("FlipDigits", () => {
  let media: ReturnType<typeof mockMatchMedia> | undefined;
  afterEach(() => media?.restore());

  it("al cambio di valore anima la vecchia cifra e poi la rimuove", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(<FlipDigits value={3} />);
    rerender(<FlipDigits value={4} />);

    expect(hidden(container)).toHaveTextContent("3");
    expect(container.querySelector(".animate-flip-top")).toHaveTextContent("3");
    const bottom = container.querySelector(
      ".animate-flip-bottom",
    ) as HTMLElement;
    expect(bottom).toHaveTextContent("4");

    // jsdom has no AnimationEvent, so React listens to the prefixed name.
    fireEvent(bottom, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(hidden(container).textContent).toBe("4");
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });

  it("si assesta sulla cifra finale anche senza animationend", () => {
    vi.useFakeTimers();
    try {
      media = mockMatchMedia(false);
      const { container, rerender } = render(<FlipDigits value={8} />);
      rerender(<FlipDigits value={9} />);
      expect(container.querySelector(".animate-flip-bottom")).not.toBeNull();
      act(() => vi.advanceTimersByTime(400));
      expect(hidden(container).textContent).toBe("9");
    } finally {
      vi.useRealTimers();
    }
  });

  it("con riduzione del movimento dal sistema mostra solo il valore finale", () => {
    media = mockMatchMedia(true);
    const { container, rerender } = render(<FlipDigits value={3} />);
    rerender(<FlipDigits value={4} />);
    expect(hidden(container).textContent).toBe("4");
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });

  it("con la prop reducedMotion mostra solo il valore finale", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(
      <FlipDigits value={3} reducedMotion />,
    );
    rerender(<FlipDigits value={4} reducedMotion />);
    expect(hidden(container).textContent).toBe("4");
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
  });

  it("non ripete un flip interrotto dalla riduzione del movimento", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(<FlipDigits value={3} />);
    rerender(<FlipDigits value={4} />);
    expect(container.querySelector(".animate-flip-bottom")).not.toBeNull();

    act(() => media?.setReduce(true));
    expect(hidden(container).textContent).toBe("4");
    act(() => media?.setReduce(false));
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
    expect(hidden(container).textContent).toBe("4");
  });

  it("con cambi rapidi riparte dall'ultima cifra mostrata", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(<FlipDigits value={3} />);
    rerender(<FlipDigits value={4} />);
    rerender(<FlipDigits value={5} />);
    expect(container.querySelector(".animate-flip-top")).toHaveTextContent("4");
    const bottom = container.querySelector(
      ".animate-flip-bottom",
    ) as HTMLElement;
    expect(bottom).toHaveTextContent("5");
    fireEvent(bottom, new Event("webkitAnimationEnd", { bubbles: true }));
    expect(hidden(container).textContent).toBe("5");
  });

  it("espone un solo testo accessibile, non cifra per cifra", () => {
    const { container } = render(<FlipDigits value={21} />);
    expect(accessibleTexts(container)).toEqual(["21"]);
    expect(screen.getByText("21")).toHaveClass("sr-only");
    expect(
      hidden(container).querySelectorAll("[data-slot=flip-cell]"),
    ).toHaveLength(2);
  });

  it("usa label come testo accessibile e riempie con zeri", () => {
    const { container } = render(
      <FlipDigits value={7} minDigits={2} label="7 punti" />,
    );
    expect(accessibleTexts(container)).toEqual(["7 punti"]);
    expect(hidden(container).textContent).toBe("07");
  });

  it("riempie con spazi cifra quando pad è blank", () => {
    const { container } = render(
      <FlipDigits value={7} minDigits={2} pad="blank" />,
    );
    expect(hidden(container).textContent).toBe(" 7");
  });

  it("aria-live polite solo se richiesto", () => {
    const { rerender } = render(<FlipDigits value={12} />);
    expect(screen.getByText("12")).not.toHaveAttribute("aria-live");
    rerender(<FlipDigits value={12} live />);
    expect(screen.getByText("12")).toHaveAttribute("aria-live", "polite");
  });

  it("usa cifre tabulari monospazio", () => {
    const { container } = render(<FlipDigits value={5} />);
    expect(container.firstElementChild).toHaveClass(
      "font-mono",
      "tabular-nums",
    );
  });
});
