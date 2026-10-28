import { describe, expect, it } from "vitest";
import { classificaGirone } from "@/lib/gironi/classifica";
import { toGroupStandings } from "./format";

describe("toGroupStandings", () => {
  it("porta punti fatti, subiti e differenza (BLVS-47)", () => {
    const gruppo = toGroupStandings(
      { id: "g1", nome: "Girone A" },
      classificaGirone(
        ["a", "b", "c", "d"],
        [
          {
            id: "p1",
            stato: "conclusa",
            squadre: { A: ["a", "b"], B: ["c", "d"] },
            sets: [{ a: 21, b: 17 }],
          },
        ],
      ),
      new Map([["a", "Rossi Luca"]]),
    );
    expect(gruppo.rows.find((r) => r.playerId === "a")).toMatchObject({
      pair: "Rossi Luca",
      played: 1,
      won: 1,
      points: 21,
      against: 17,
      diff: 4,
    });
    expect(gruppo.rows.find((r) => r.playerId === "c")).toMatchObject({
      points: 17,
      against: 21,
      diff: -4,
    });
  });
});
