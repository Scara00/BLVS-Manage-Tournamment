"use client";

import { useCallback, useSyncExternalStore } from "react";

/** `md` breakpoint (768 px), the switch between mobile and desktop layouts. */
export const DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * Whether the media query matches. Server render and hydration report
 * `false`, so layouts must not depend on it for their first paint: switch
 * layouts with CSS and use this only to react to breakpoint changes.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
