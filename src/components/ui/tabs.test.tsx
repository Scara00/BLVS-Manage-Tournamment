import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

function Sezioni() {
  return (
    <Tabs defaultValue="gironi">
      <TabsList aria-label="Sezioni del torneo">
        <TabsTrigger value="gironi">Gironi</TabsTrigger>
        <TabsTrigger value="tabellone">Tabellone</TabsTrigger>
        <TabsTrigger value="squadre">Squadre</TabsTrigger>
      </TabsList>
      <TabsContent value="gironi">Classifica dei gironi</TabsContent>
      <TabsContent value="tabellone">Tabellone a eliminazione</TabsContent>
      <TabsContent value="squadre">Elenco squadre</TabsContent>
    </Tabs>
  );
}

describe("Tabs", () => {
  it("espone tablist, tab e tabpanel collegati", () => {
    render(<Sezioni />);

    expect(
      screen.getByRole("tablist", { name: "Sezioni del torneo" }),
    ).toBeInTheDocument();
    const tab = screen.getByRole("tab", { name: "Gironi" });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
    expect(panel).toHaveTextContent("Classifica dei gironi");
    expect(screen.getByRole("tab", { name: "Tabellone" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("le frecce, Home e Fine spostano focus e selezione", async () => {
    const user = userEvent.setup();
    render(<Sezioni />);
    const gironi = screen.getByRole("tab", { name: "Gironi" });
    const tabellone = screen.getByRole("tab", { name: "Tabellone" });
    const squadre = screen.getByRole("tab", { name: "Squadre" });

    await user.tab();
    expect(gironi).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(tabellone).toHaveFocus();
    expect(tabellone).toHaveAttribute("aria-selected", "true");
    expect(
      document.getElementById(tabellone.getAttribute("aria-controls")!),
    ).toHaveTextContent("Tabellone a eliminazione");

    await user.keyboard("{End}");
    expect(squadre).toHaveFocus();
    expect(squadre).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(gironi).toHaveFocus();
    expect(gironi).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(squadre).toHaveFocus();
    expect(squadre).toHaveAttribute("aria-selected", "true");
  });

  it("usa un solo tab stop (roving tabindex)", () => {
    render(<Sezioni />);

    const stops = screen
      .getAllByRole("tab")
      .filter((tab) => tab.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });
});
