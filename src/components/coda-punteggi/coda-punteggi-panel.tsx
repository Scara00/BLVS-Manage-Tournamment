"use client";

import { StatoInvio } from "./stato-invio";
import { useCodaPunteggi } from "./coda-provider";
import { CodaPunteggiView } from "./coda-punteggi-view";

/** The device queue with its actions (w-admin-live, w-admin-punteggio). */
export function CodaPunteggiPanel({ className }: { className?: string }) {
  const coda = useCodaPunteggi();
  return (
    <CodaPunteggiView
      voci={coda.voci}
      className={className}
      onTieniIlMio={(chiave) => void coda.tieniIlMio(chiave)}
      onTieniQuelloSalvato={(chiave) => void coda.tieniQuelloSalvato(chiave)}
      onTogli={(chiave) => void coda.togli(chiave)}
    />
  );
}

/** The state of one match's score on this device; nothing if none. */
export function StatoPunteggioPartita({
  partitaId,
  className,
}: {
  partitaId: string;
  className?: string;
}) {
  const voce = useCodaPunteggi().statoPartita(partitaId);
  return voce ? <StatoInvio stato={voce.stato} className={className} /> : null;
}
