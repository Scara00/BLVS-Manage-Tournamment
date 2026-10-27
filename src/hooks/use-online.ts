"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the browser reports a network connection (`navigator.onLine`).
 * Server render and hydration report `true`. `force` overrides it, e.g. to
 * show the offline state in Storybook.
 */
export function useOnline(force?: boolean): boolean {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return force ?? online;
}
