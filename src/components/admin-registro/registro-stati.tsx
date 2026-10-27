import { InboxIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";
import { GestioneTappaLoading } from "@/components/admin-tappa/gestione-tappa-loading";
import { buttonVariants } from "@/components/ui/button";

/** Suspense fallback while the log is read (state: loading). */
export function RegistroLoading() {
  return <GestioneTappaLoading testo="Caricamento del registro…" />;
}

/** No entries yet, or none for the chosen filters (state: empty). */
export function RegistroVuoto({
  filtri,
  azzeraHref,
}: {
  /** Summary of the active filters, null without filters. */
  filtri: string | null;
  azzeraHref: string;
}) {
  return (
    <div
      data-testid="registro-vuoto"
      className="flex flex-col items-start gap-space-3 border-2 border-neutral-200 p-inset md:p-inset-lg"
    >
      <InboxIcon aria-hidden className="size-6 text-muted-foreground" />
      {filtri ? (
        <>
          <p className="font-heading text-lg font-semibold">
            Nessuna voce per questi filtri
          </p>
          <p className="[overflow-wrap:anywhere]">Filtri: {filtri}.</p>
          <Link
            href={azzeraHref}
            className={buttonVariants({
              variant: "secondary",
              className: "max-w-full",
            })}
          >
            Azzera i filtri
          </Link>
        </>
      ) : (
        <>
          <p className="font-heading text-lg font-semibold">
            Il registro è ancora vuoto
          </p>
          <p>
            Qui compaiono inserimenti, correzioni e annullamenti dei punteggi,
            ritiri, parità risolte, rigenerazioni dei gironi e cambi di
            categoria, con autore, data e ora.
          </p>
        </>
      )}
    </div>
  );
}

/** Offline: the entries shown are those read at `lettoAlle` (state: offline). */
export function RegistroOffline({ lettoAlle }: { lettoAlle: string }) {
  return (
    <p className="flex items-start gap-space-2 border-s-4 border-warning-fg bg-warning-bg p-inset-sm text-warning-fg">
      <WifiOffIcon aria-hidden className="mt-1 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Sei offline.</strong> Il registro
        mostra le voci lette alle{" "}
        <span className="font-mono tabular-nums">{lettoAlle}</span>: per
        caricare le precedenti serve la rete.
      </span>
    </p>
  );
}
