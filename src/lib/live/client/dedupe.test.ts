import { describe, expect, it } from "vitest";
import { createDeduper } from "./dedupe";

describe("createDeduper", () => {
  it("accetta ogni evento una sola volta", () => {
    const dedupe = createDeduper();
    expect(dedupe.accept(1)).toBe(true);
    expect(dedupe.accept(1)).toBe(false);
    expect(dedupe.accept(2)).toBe(true);
  });

  it("scarta gli eventi già compresi nello snapshot", () => {
    const dedupe = createDeduper();
    dedupe.reset(5);
    expect([4, 5, 6].map((seq) => dedupe.accept(seq))).toEqual([
      false,
      false,
      true,
    ]);
    expect(dedupe.lastSeq).toBe(6);
  });

  it("dopo un riallineamento a un seq più basso (server riavviato) riparte da lì", () => {
    const dedupe = createDeduper(40);
    dedupe.reset(2);
    expect(dedupe.accept(3)).toBe(true);
  });
});
