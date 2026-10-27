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
 * `navigator.onLine`, kept up to date by the `online`/`offline` events.
 * Online on the server. `force` (stories, tests) wins over the browser.
 */
export function useOnlineStatus(force?: boolean): boolean {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  return force ?? online;
}

const noopSubscribe = () => () => {};

/** False while rendering on the server and hydrating, true afterwards. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
