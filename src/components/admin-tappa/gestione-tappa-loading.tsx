import { Loader2Icon } from "lucide-react";

/** Suspense fallback while the stage is read (state: loading). */
export function GestioneTappaLoading({
  testo = "Caricamento della tappa…",
}: {
  testo?: string;
}) {
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
        {testo}
      </p>
      <div aria-hidden className="flex flex-col gap-space-3">
        <span className="block h-8 w-1/2 bg-neutral-100" />
        <span className="block h-16 w-full bg-neutral-100" />
        <span className="block h-6 w-1/3 bg-neutral-100" />
      </div>
    </div>
  );
}
