import { GestioneTappaLoading } from "@/components/admin-tappa";

/** Suspense fallback while the board's matches are read (state: loading). */
export function AdminLiveLoading() {
  return <GestioneTappaLoading testo="Caricamento delle partite…" />;
}
