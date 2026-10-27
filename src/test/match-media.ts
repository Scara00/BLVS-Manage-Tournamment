import { vi } from "vitest";

/**
 * jsdom has no `matchMedia`. Installs a fake one where every query reports
 * `reduce`, and lets the test flip it (firing `change`). Import it per test.
 */
export function mockMatchMedia(reduce: boolean) {
  let matches = reduce;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const matchMedia = vi.fn((media: string) => ({
    get matches() {
      return matches;
    },
    media,
    onchange: null,
    addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeEventListener: (
      _: string,
      cb: (event: MediaQueryListEvent) => void,
    ) => listeners.delete(cb),
    addListener: (cb: (event: MediaQueryListEvent) => void) =>
      listeners.add(cb),
    removeListener: (cb: (event: MediaQueryListEvent) => void) =>
      listeners.delete(cb),
    dispatchEvent: () => true,
  }));
  vi.stubGlobal("matchMedia", matchMedia);

  return {
    setReduce(next: boolean) {
      matches = next;
      for (const cb of listeners) {
        cb({ matches: next, media: "" } as MediaQueryListEvent);
      }
    },
    restore() {
      vi.unstubAllGlobals();
    },
  };
}
