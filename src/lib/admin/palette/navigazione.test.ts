import { describe, expect, it } from "vitest";
import {
  etichettaScorciatoia,
  isScorciatoiaPalette,
  prossimoAttivo,
} from "./navigazione";

describe("prossimoAttivo", () => {
  it("le frecce partono dagli estremi e girano", () => {
    expect(prossimoAttivo(3, null, "ArrowDown")).toBe(0);
    expect(prossimoAttivo(3, null, "ArrowUp")).toBe(2);
    expect(prossimoAttivo(3, 1, "ArrowDown")).toBe(2);
    expect(prossimoAttivo(3, 2, "ArrowDown")).toBe(0);
    expect(prossimoAttivo(3, 0, "ArrowUp")).toBe(2);
  });

  it("Home e Fine vanno agli estremi, gli altri tasti non spostano", () => {
    expect(prossimoAttivo(4, 2, "Home")).toBe(0);
    expect(prossimoAttivo(4, 1, "End")).toBe(3);
    expect(prossimoAttivo(4, 1, "a")).toBe(1);
  });

  it("senza opzioni nessuna è attiva", () => {
    expect(prossimoAttivo(0, null, "ArrowDown")).toBeNull();
    expect(prossimoAttivo(2, 5, "x")).toBeNull();
  });
});

describe("scorciatoia", () => {
  const tasto = {
    key: "k",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
  };

  it("Ctrl+K e Cmd+K aprono la palette", () => {
    expect(isScorciatoiaPalette({ ...tasto, ctrlKey: true })).toBe(true);
    expect(isScorciatoiaPalette({ ...tasto, metaKey: true, key: "K" })).toBe(
      true,
    );
  });

  it("K da solo, con Alt o durante la composizione no", () => {
    expect(isScorciatoiaPalette(tasto)).toBe(false);
    expect(
      isScorciatoiaPalette({ ...tasto, ctrlKey: true, altKey: true }),
    ).toBe(false);
    expect(
      isScorciatoiaPalette({ ...tasto, ctrlKey: true, isComposing: true }),
    ).toBe(false);
  });

  it("su Apple mostra ⌘, altrove Ctrl", () => {
    expect(etichettaScorciatoia("MacIntel")).toBe("⌘ K");
    expect(etichettaScorciatoia("macOS")).toBe("⌘ K");
    expect(etichettaScorciatoia("Win32")).toBe("Ctrl K");
  });
});
