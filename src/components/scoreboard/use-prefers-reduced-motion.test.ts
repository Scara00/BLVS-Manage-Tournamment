import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mockMatchMedia } from "@/test/match-media";
import {
  usePrefersReducedMotion,
  useReducedMotion,
} from "./use-prefers-reduced-motion";

describe("useReducedMotion", () => {
  let media: ReturnType<typeof mockMatchMedia> | undefined;
  afterEach(() => media?.restore());

  it("segue la media query e reagisce all'evento change", () => {
    media = mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    act(() => media!.setReduce(true));
    expect(result.current).toBe(true);
  });

  it("la prop esplicita vince sulla media query", () => {
    media = mockMatchMedia(true);
    const { result, rerender } = renderHook(
      ({ force }: { force?: boolean }) => useReducedMotion(force),
      { initialProps: { force: false } as { force?: boolean } },
    );
    expect(result.current).toBe(false);
    rerender({ force: undefined });
    expect(result.current).toBe(true);
  });

  it("senza matchMedia anima normalmente", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
