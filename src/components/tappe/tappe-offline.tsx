"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const isOffline = () => !navigator.onLine;
// The server always renders online: the notice only ever appears client-side.
const isOfflineOnServer = () => false;

/**
 * Warns that the list may be stale while the device is offline. The status
 * region stays mounted, so the warning is announced when it appears.
 */
export function TappeOffline({
  offline: forced,
  className,
}: {
  /** Overrides `navigator.onLine` (stories, tests). */
  offline?: boolean;
  className?: string;
}) {
  const detected = useSyncExternalStore(
    subscribe,
    isOffline,
    isOfflineOnServer,
  );
  const offline = forced ?? detected;
  return (
    <div role="status" className={cn(!offline && "contents", className)}>
      {offline ? (
        <p className="flex items-start gap-space-2 border-s-4 border-warning-fg bg-warning-bg p-inset-sm text-warning-fg">
          <WifiOff aria-hidden="true" className="mt-1 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Sei offline.</strong> Posti e
            stati potrebbero non essere aggiornati: ricarica la pagina quando
            torna la rete.
          </span>
        </p>
      ) : null}
    </div>
  );
}
