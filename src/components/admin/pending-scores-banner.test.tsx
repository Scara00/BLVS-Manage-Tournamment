import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  mergePendingScores,
  PendingScoresBannerView,
} from "./pending-scores-banner";

const jesolo = { id: "jesolo", label: "Tappa 1 · Jesolo", count: 3 };

describe("banner «partite da inserire»", () => {
  it("non compare fuori dal giorno di gara", () => {
    const { container } = render(<PendingScoresBannerView stages={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dice quante partite mancano, con un'intestazione leggibile", () => {
    render(<PendingScoresBannerView stages={[jesolo]} />);
    const banner = screen.getByRole("region", {
      name: "3 partite da inserire",
    });
    expect(banner).toHaveAttribute("data-count", "3");
    expect(banner).toHaveTextContent("Tappa 1 · Jesolo");
  });

  it("al singolare con una partita", () => {
    render(<PendingScoresBannerView stages={[{ ...jesolo, count: 1 }]} />);
    expect(
      screen.getByRole("heading", { name: "1 partita da inserire" }),
    ).toBeInTheDocument();
  });

  it("a zero dice che è tutto inserito", () => {
    render(<PendingScoresBannerView stages={[{ ...jesolo, count: 0 }]} />);
    expect(
      screen.getByRole("heading", { name: "Tutte le partite sono inserite" }),
    ).toBeInTheDocument();
  });

  it("somma più tappe e le elenca", () => {
    render(
      <PendingScoresBannerView
        stages={[jesolo, { id: "rimini", label: "Tappa 2 · Rimini", count: 2 }]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "5 partite da inserire" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("il conteggio live sostituisce quello del server, solo per le tappe di oggi", () => {
    expect(
      mergePendingScores(
        [jesolo],
        [
          { ...jesolo, count: 1 },
          { id: "altra", label: "Altra", count: 9 },
        ],
      ),
    ).toEqual([{ ...jesolo, count: 1 }]);
    expect(mergePendingScores([jesolo], [])).toEqual([jesolo]);
  });
});
