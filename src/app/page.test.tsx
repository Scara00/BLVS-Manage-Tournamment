import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("mostra il titolo dell'app", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "BLVS – Manage Tournament" }),
  ).toBeInTheDocument();
});
