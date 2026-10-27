import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryLabel } from "./category-label";

describe("CategoryLabel", () => {
  it.each([
    ["maschile", "Maschile"],
    ["femminile", "Femminile"],
  ] as const)("%s → «%s»", (category, text) => {
    const { container } = render(<CategoryLabel category={category} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
