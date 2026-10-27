import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import { LiveBar } from "./live-bar";

// 08:05Z / 08:30Z are 10:05 / 10:30 in Rome (CEST).
const times = {
  updatedAt: "2026-06-14T08:05:00.000Z",
  freshAt: "2026-06-14T08:30:00.000Z",
};

let media: ReturnType<typeof mockMatchMedia> | undefined;
afterEach(() => media?.restore());

describe("LiveBar", () => {
  it("live: etichetta «Live» e orario dell'ultimo aggiornamento", () => {
    render(<LiveBar status="live" {...times} />);
    const bar = screen.getByRole("region", {
      name: "Stato degli aggiornamenti",
    });
    expect(bar).toHaveTextContent("Live");
    expect(bar).toHaveTextContent("Ultimo aggiornamento alle 10:05");
    expect(screen.getByText("10:05")).toHaveAttribute(
      "datetime",
      times.updatedAt,
    );
    expect(screen.getByText("10:05")).toHaveClass("font-mono");
  });

  it("offline: dati non aggiornati dall'ultima conferma", () => {
    render(<LiveBar status="offline" {...times} />);
    expect(screen.getByText(/Dati non aggiornati dalle/)).toHaveTextContent(
      "Dati non aggiornati dalle 10:30",
    );
    expect(screen.getByText(/Sei offline/)).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });

  it("in riconnessione: avviso e tentativo in corso", () => {
    render(<LiveBar status="reconnecting" {...times} />);
    expect(screen.getByText(/Dati non aggiornati dalle/)).toHaveTextContent(
      "10:30",
    );
    expect(screen.getByText("Riconnessione in corso…")).toBeInTheDocument();
  });

  it("in connessione: nessun orario", () => {
    render(<LiveBar status="connecting" {...times} />);
    expect(screen.getByText(/Connessione agli aggiornamenti/)).toBeVisible();
    expect(screen.queryByRole("time")).not.toBeInTheDocument();
  });

  it("con riduzione del movimento niente pulsazioni né rotazioni", () => {
    media = mockMatchMedia(true);
    const { container, rerender } = render(
      <LiveBar status="live" {...times} />,
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
    rerender(<LiveBar status="reconnecting" {...times} />);
    expect(container.querySelector(".animate-spin")).toBeNull();
  });

  it("senza riduzione del movimento il punto live pulsa", () => {
    media = mockMatchMedia(false);
    const { container } = render(<LiveBar status="live" {...times} />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});
