"use client";

import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;
}

/** SSR and hydration render the final value only: no animation. */
function getServerSnapshot() {
  return true;
}

/** Live value of `prefers-reduced-motion: reduce`. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Whether a component should skip its animation. An explicit `force` prop
 * wins; otherwise the user's OS setting decides.
 */
export function useReducedMotion(force?: boolean): boolean {
  const prefers = usePrefersReducedMotion();
  return force ?? prefers;
}
