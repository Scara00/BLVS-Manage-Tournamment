/** Suspense fallback of w-tappa and w-iscrizione-ok. */
export function TappaLoading({ what = "della tappa" }: { what?: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-stack-sm">
      <p className="text-muted-foreground">Caricamento {what}…</p>
      <div aria-hidden="true" className="flex flex-col gap-space-2">
        <span className="block h-10 w-2/3 bg-neutral-100" />
        <span className="block h-24 w-full bg-neutral-100" />
        <span className="block h-24 w-full bg-neutral-100" />
      </div>
    </div>
  );
}
