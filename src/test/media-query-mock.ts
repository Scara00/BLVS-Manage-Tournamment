import { vi } from "vitest";

/**
 * Stubs `window.matchMedia` with a controllable query list (jsdom has none).
 * `set(matches)` flips every query and fires `change`, like crossing a
 * breakpoint. Undo with `vi.unstubAllGlobals()`.
 */
export function installMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) =>
        listeners.add(l),
      removeEventListener: (_: string, l: (e: MediaQueryListEvent) => void) =>
        listeners.delete(l),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  return {
    set(next: boolean) {
      matches = next;
      for (const l of [...listeners]) {
        l({ matches } as MediaQueryListEvent);
      }
    },
  };
}
