import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("mostra il titolo dell'app", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "BLVS – Manage Tournament" }),
  ).toBeInTheDocument();
});

test("porta alle sezioni del giocatore", () => {
  render(<Home />);
  for (const name of ["Tappe", "Live", "Classifica"]) {
    expect(screen.getByRole("link", { name })).toBeInTheDocument();
  }
});

test("invita i nuovi giocatori a registrarsi", () => {
  render(<Home />);
  expect(screen.getByRole("link", { name: "Registrati" })).toHaveAttribute(
    "href",
    "/registrati",
  );
});
