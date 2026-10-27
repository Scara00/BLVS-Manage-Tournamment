import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyIndex } from "./privacy-index";

const sections = [
  { id: "uno", title: "Uno" },
  { id: "due", title: "Due" },
  { id: "tre", title: "Tre" },
];

/** Section tops in px, relative to the viewport. */
let tops: Record<string, number> = {};

function Page() {
  return (
    <>
      <PrivacyIndex sections={sections} />
      {sections.map((s) => (
        <section key={s.id} id={s.id} tabIndex={-1}>
          {s.title}
        </section>
      ))}
    </>
  );
}

function scrollTo(next: Record<string, number>) {
  tops = next;
  act(() => {
    fireEvent.scroll(window);
    vi.runAllTimers();
  });
}

const link = (name: string) =>
  screen.getByRole("link", { name, hidden: false });

describe("indice con sezione attiva", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("innerHeight", 1000);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const top = tops[this.id] ?? 0;
        return { top, bottom: top + 400 } as DOMRect;
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 0),
    );
    tops = { uno: 0, due: 600, tre: 1200 };
    window.location.hash = "";
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("segue lo scorrimento con aria-current", () => {
    render(<Page />);
    expect(link("Uno")).toHaveAttribute("aria-current", "location");
    scrollTo({ uno: -700, due: -100, tre: 500 });
    expect(link("Due")).toHaveAttribute("aria-current", "location");
    expect(link("Uno")).not.toHaveAttribute("aria-current");
  });

  it("un clic segna la sezione e le sposta il focus", () => {
    render(<Page />);
    fireEvent.click(link("Tre"));
    expect(link("Tre")).toHaveAttribute("aria-current", "location");
    expect(document.getElementById("tre")).toHaveFocus();
    // Too close to the end to reach the line: it stays current while visible.
    scrollTo({ uno: -900, due: -300, tre: 400 });
    expect(link("Tre")).toHaveAttribute("aria-current", "location");
  });
});
