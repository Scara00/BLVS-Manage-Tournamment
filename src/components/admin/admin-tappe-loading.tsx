/** Suspense fallback of the stage table (state: loading). */
export function AdminTappeLoading() {
  return (
    <p className="text-muted-foreground" aria-busy="true">
      Caricamento delle tappe…
    </p>
  );
}
