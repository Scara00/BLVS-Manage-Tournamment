import { render, screen } from "@testing-library/react";
import { RadioIcon } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("mostra il testo", () => {
    render(<Badge variant="reg-open">Iscrizioni aperte</Badge>);
    expect(screen.getByText("Iscrizioni aperte")).toBeVisible();
  });

  it("un badge solo icona ha comunque un testo per lo screen reader", () => {
    render(
      <p data-testid="riga">
        <Badge variant="live" icon={<RadioIcon />} label="In diretta" />
      </p>,
    );
    const row = screen.getByTestId("riga");
    expect(row).toHaveTextContent("In diretta");
    expect(row.querySelector("svg")?.closest("[aria-hidden]")).not.toBeNull();
  });

  it("la variante predefinita è neutra", () => {
    render(<Badge>Bozza</Badge>);
    expect(screen.getByText("Bozza")).toHaveAttribute(
      "data-variant",
      "neutral",
    );
  });

  it("i tipi impediscono un badge senza testo", () => {
    // @ts-expect-error: né children né label.
    void (<Badge variant="success" />);
    // @ts-expect-error: un'icona senza label non ha nome accessibile.
    void (<Badge icon={<RadioIcon />} />);
    // @ts-expect-error: label e children sono alternativi.
    void (<Badge label="A">B</Badge>);
    expect(true).toBe(true);
  });
});
