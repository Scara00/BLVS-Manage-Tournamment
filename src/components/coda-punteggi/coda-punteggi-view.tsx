import Link from "next/link";
import { Button } from "@/components/ui/button";
import { riassuntoCoda } from "@/lib/punteggi/coda/coda";
import type { VoceCoda } from "@/lib/punteggi/coda/types";
import { cn } from "@/lib/utils";
import { descriviSets, oraBreve } from "./format";
import { StatoInvio } from "./stato-invio";

export type AzioniCoda = {
  /** `conflitto`: send mine again over the score shown. */
  onTieniIlMio?: (chiave: string) => void;
  /** `conflitto`: keep the other admin's score, drop mine. */
  onTieniQuelloSalvato?: (chiave: string) => void;
  /** `rifiutato`: drop it from the list. */
  onTogli?: (chiave: string) => void;
};

/** Newest first: what the admin just typed is on top. */
function ordina(voci: readonly VoceCoda[]) {
  return [...voci].sort((a, b) => b.creataIl.localeCompare(a.creataIl));
}

/** One queued score: state as text, match, sets and time in mono. */
export function VoceCodaRiga({
  voce,
  onTieniIlMio,
  onTieniQuelloSalvato,
  onTogli,
}: { voce: VoceCoda } & AzioniCoda) {
  return (
    <li
      data-chiave={voce.chiave}
      data-partita={voce.partitaId}
      data-stato={voce.stato}
      className={cn(
        "flex flex-col gap-space-2 border-s-4 p-inset-sm [overflow-wrap:anywhere]",
        voce.stato === "in_attesa" || voce.stato === "invio"
          ? "border-tape bg-tape-soft"
          : voce.stato === "salvato"
            ? "border-success-fg"
            : voce.stato === "rifiutato"
              ? "border-error-fg"
              : "border-warning-fg bg-warning-bg",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-space-3 gap-y-space-1">
        <StatoInvio stato={voce.stato} />
        <Link
          href={voce.path}
          className="font-semibold underline underline-offset-4 focus-ring"
        >
          {voce.etichetta}
        </Link>
      </div>
      <p className="flex flex-wrap gap-x-space-3 text-sm">
        <span>
          Punteggio <span className="font-mono">{descriviSets(voce.sets)}</span>
        </span>
        <span>
          inserito alle{" "}
          <time dateTime={voce.creataIl} className="font-mono">
            {oraBreve(voce.creataIl)}
          </time>
        </span>
      </p>
      {voce.stato === "conflitto" && voce.server ? (
        <div className="flex flex-col gap-space-2">
          <p className="text-sm">
            Un altro admin ha salvato{" "}
            <span className="font-mono">{descriviSets(voce.server.sets)}</span>.
            Quale punteggio tieni?
          </p>
          <div className="flex flex-wrap gap-space-2">
            <Button
              size="sm"
              className="max-w-full"
              onClick={() => onTieniIlMio?.(voce.chiave)}
            >
              Tieni il mio{" "}
              <span className="font-mono">{descriviSets(voce.sets)}</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="max-w-full"
              onClick={() => onTieniQuelloSalvato?.(voce.chiave)}
            >
              Tieni quello salvato{" "}
              <span className="font-mono">
                {descriviSets(voce.server.sets)}
              </span>
            </Button>
          </div>
        </div>
      ) : null}
      {voce.stato === "rifiutato" ? (
        <div className="flex flex-wrap items-center gap-space-2">
          {voce.messaggio ? <p className="text-sm">{voce.messaggio}</p> : null}
          <Button
            size="sm"
            variant="secondary"
            className="max-w-full"
            onClick={() => onTogli?.(voce.chiave)}
          >
            Togli dalla lista
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * The scores kept on this device (w-admin-live, w-admin-punteggio). Hidden
 * when the queue is empty or still being read.
 */
export function CodaPunteggiView({
  voci,
  className,
  ...azioni
}: {
  voci: readonly VoceCoda[] | null;
  className?: string;
} & AzioniCoda) {
  if (!voci || voci.length === 0) return null;
  const riassunto = riassuntoCoda(voci);
  return (
    <section
      aria-labelledby="coda-punteggi-titolo"
      data-slot="coda-punteggi"
      className={cn("flex flex-col gap-space-3", className)}
    >
      <h2
        id="coda-punteggi-titolo"
        className="font-heading text-xl font-semibold"
      >
        Punteggi su questo dispositivo
      </h2>
      <p>
        {riassunto
          ? `${riassunto}. Partono da soli appena c'è rete.`
          : "Tutti i punteggi sono stati inviati."}
      </p>
      <ul className="flex flex-col gap-space-2" aria-label="Punteggi in coda">
        {ordina(voci).map((voce) => (
          <VoceCodaRiga key={voce.chiave} voce={voce} {...azioni} />
        ))}
      </ul>
    </section>
  );
}

/**
 * w-admin-sessione: the scores entered before the session closed that did
 * not reach the server. `null` while the device queue is being read.
 */
export function PunteggiNonInviati({ voci }: { voci: VoceCoda[] | null }) {
  if (voci === null)
    return <p role="status">Controllo i punteggi su questo dispositivo…</p>;
  const nonInviati = voci.filter(
    (v) =>
      v.stato === "in_attesa" ||
      v.stato === "invio" ||
      v.stato === "sessione_chiusa",
  );
  if (nonInviati.length === 0)
    return <p>Nessun punteggio in attesa su questo dispositivo.</p>;
  return (
    <>
      <p>
        Questi punteggi sono salvati solo su questo dispositivo. Partono da soli
        dopo il nuovo accesso: non vanno reinseriti.
      </p>
      <ul
        className="flex flex-col gap-space-2"
        aria-label="Punteggi non ancora inviati"
      >
        {ordina(nonInviati).map((voce) => (
          <VoceCodaRiga
            key={voce.chiave}
            voce={{ ...voce, stato: "sessione_chiusa" }}
          />
        ))}
      </ul>
    </>
  );
}
