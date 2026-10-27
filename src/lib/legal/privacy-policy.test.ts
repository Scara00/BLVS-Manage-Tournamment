import { describe, expect, it } from "vitest";
import {
  PRIVACY_POLICY_VERSION,
  formatPolicyDate,
  privacySections,
} from "./privacy-policy";

describe("versione dell'informativa privacy", () => {
  it("espone numero e data ISO valida", () => {
    expect(PRIVACY_POLICY_VERSION.number).toMatch(/^\d+\.\d+$/);
    expect(PRIVACY_POLICY_VERSION.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(PRIVACY_POLICY_VERSION.date).getTime())).toBe(
      false,
    );
  });

  it("formatta la data in italiano", () => {
    expect(formatPolicyDate("2026-10-27")).toBe("27 ottobre 2026");
  });
});

describe("sezioni dell'informativa", () => {
  it("hanno id univoci e utilizzabili come ancore", () => {
    const ids = privacySections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });
});
