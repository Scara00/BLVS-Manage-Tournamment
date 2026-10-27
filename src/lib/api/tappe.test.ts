import { describe, expect, it } from "vitest";
import { readTappa } from "./tappe";

describe("readTappa", () => {
  it.each(["annullata", "archiviata"])(
    "non accetta lo stato «%s»: si passa dalle azioni della dashboard",
    (stato) => {
      const { reader } = readTappa({ stato }, true);
      expect(reader.ok).toBe(false);
      expect(reader.errors.stato).toMatch(/dashboard admin/);
    },
  );

  it("accetta gli altri stati", () => {
    const { reader, values } = readTappa({ stato: "in_corso" }, true);
    expect(reader.ok).toBe(true);
    expect(values.stato).toBe("in_corso");
  });
});
