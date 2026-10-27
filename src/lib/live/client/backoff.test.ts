import { describe, expect, it } from "vitest";
import { BACKOFF_MAX_MS, backoffDelay } from "./backoff";

describe("backoffDelay", () => {
  it("raddoppia a ogni tentativo partendo da 1 s", () => {
    const full = () => 1;
    expect([0, 1, 2, 3, 4].map((a) => backoffDelay(a, full))).toEqual([
      1000, 2000, 4000, 8000, 16000,
    ]);
  });

  it("non supera i 30 s", () => {
    expect(backoffDelay(10, () => 1)).toBe(BACKOFF_MAX_MS);
    expect(backoffDelay(50, () => 1)).toBe(BACKOFF_MAX_MS);
  });

  it("il jitter resta tra metà e tutto il passo", () => {
    expect(backoffDelay(2, () => 0)).toBe(2000);
    expect(backoffDelay(2, () => 0.5)).toBe(3000);
  });
});
