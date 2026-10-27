import { Loader2Icon } from "lucide-react";

/** Suspense fallback while the profile is read (state: loading). */
export function ProfiloLoading() {
  return (
    <div
      aria-busy="true"
      className="flex max-w-3xl flex-col gap-space-3 border-2 border-neutral-200 p-inset md:p-inset-lg"
    >
      <p
        role="status"
        className="flex items-center gap-space-2 text-muted-foreground"
      >
        <Loader2Icon
          aria-hidden
          className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
        Caricamento del profilo…
      </p>
      <div aria-hidden className="flex flex-col gap-space-3">
        <span className="block h-6 w-1/2 bg-neutral-100" />
        <span className="block h-6 w-2/3 bg-neutral-100" />
        <span className="block h-6 w-1/3 bg-neutral-100" />
      </div>
    </div>
  );
}
