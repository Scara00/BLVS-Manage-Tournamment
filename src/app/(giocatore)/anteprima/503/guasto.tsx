"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Throws on the client only, so the prerender succeeds and error.tsx catches it. */
export function Guasto(): null {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (hydrated) throw new Error("Anteprima: servizio non disponibile");
  return null;
}
