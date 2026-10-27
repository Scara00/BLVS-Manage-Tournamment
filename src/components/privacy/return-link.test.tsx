import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReturnLink } from "./return-link";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

function renderLink() {
  render(<ReturnLink>Torna alla pagina precedente</ReturnLink>);
  return screen.getByRole("link", { name: "Torna alla pagina precedente" });
}

describe("ReturnLink", () => {
  beforeEach(() => {
    search = "";
  });

  it("torna alla pagina di origine interna", () => {
    search = "da=%2Ftappe%3Fcategoria%3Dmisto";
    expect(renderLink()).toHaveAttribute("href", "/tappe?categoria=misto");
  });

  it.each([
    "da=https%3A%2F%2Fevil.example",
    "da=%2F%2Fevil.example",
    "da=%2F%5Cevil.example",
    "da=javascript%3Aalert(1)",
  ])("rifiuta il percorso esterno (%s) e porta alla home", (query) => {
    search = query;
    expect(renderLink()).toHaveAttribute("href", "/");
  });

  it("senza origine porta alla home", () => {
    expect(renderLink()).toHaveAttribute("href", "/");
  });
});
