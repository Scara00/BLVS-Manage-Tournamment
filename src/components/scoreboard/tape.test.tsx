import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import { Tape } from "./tape";

describe("Tape", () => {
  let media: ReturnType<typeof mockMatchMedia> | undefined;
  afterEach(() => media?.restore());

  it.each([
    [4, "h-1"],
    [8, "h-2"],
  ] as const)("spessore %i px → %s", (size, cls) => {
    const { container } = render(<Tape size={size} />);
    expect(container.firstElementChild).toHaveClass("bg-tape", cls);
  });

  it("è decorativo e nascosto alle tecnologie assistive", () => {
    const { container } = render(<Tape />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("scatta solo se animated e senza riduzione del movimento", () => {
    media = mockMatchMedia(false);
    const { container, rerender } = render(<Tape />);
    expect(container.firstElementChild).not.toHaveClass("animate-tape-snap");
    rerender(<Tape animated />);
    expect(container.firstElementChild).toHaveClass("animate-tape-snap");
    rerender(<Tape animated reducedMotion />);
    expect(container.firstElementChild).not.toHaveClass("animate-tape-snap");
  });

  it("rispetta la preferenza di sistema", () => {
    media = mockMatchMedia(true);
    const { container } = render(<Tape animated />);
    expect(container.firstElementChild).not.toHaveClass("animate-tape-snap");
  });
});
