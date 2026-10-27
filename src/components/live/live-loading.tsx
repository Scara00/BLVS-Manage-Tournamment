import { LiveBar } from "./live-bar";

/** Suspense fallback while the live snapshot is read (state: loading). */
export function LiveLoading({ what }: { what: string }) {
  return (
    <div className="flex flex-col gap-stack" aria-busy="true">
      <LiveBar
        status="connecting"
        updatedAt="1970-01-01T00:00:00.000Z"
        freshAt="1970-01-01T00:00:00.000Z"
        reducedMotion
      />
      <p className="text-muted-foreground">Caricamento {what}…</p>
    </div>
  );
}
