import { Loader2Icon } from "lucide-react";

/** Suspense fallback while the groups are read (state: loading). */
export function GironiEditorLoading() {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-space-3 border-2 border-neutral-200 p-inset md:p-inset-lg"
    >
      <p
        role="status"
        className="flex items-center gap-space-2 text-muted-foreground"
      >
        <Loader2Icon
          aria-hidden
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
        Caricamento dei gironi…
      </p>
      <div
        aria-hidden
        className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-space-3"
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-56 bg-neutral-100" />
        ))}
      </div>
    </div>
  );
}
