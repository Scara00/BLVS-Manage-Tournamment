import type { Categoria, StatoIscrizione } from "@/lib/db/types";
import { formatScadenza } from "@/lib/tappe/format";
import {
  conseguenzeAnnullamento,
  puoAnnullare,
  testoNonAnnullabile,
  type MotivoNonAnnullabile,
  type TappaAnnullabile,
} from "./regola";

/** «nel maschile», «nel femminile» (kept here: `dettaglio.ts` imports us). */
function nelTabellone(categoria: Categoria): string {
  return categoria === "M" ? "nel maschile" : "nel femminile";
}

/**
 * Everything the cancel action and its dialog (w-annulla-iscrizione) need,
 * shared by w-mie-iscrizioni, w-tappa and w-iscrizione-ok.
 */
export type AnnullamentoView = {
  /** `iscrizioni.id`; in the demo, the stage id. */
  iscrizioneId: string;
  tappaId: string;
  /** Stage name, e.g. «Tappa 2 · Rimini». */
  tappa: string;
  posto: number | null;
  categoria: Categoria;
  possibile: boolean;
  motivo: MotivoNonAnnullabile | null;
  /** «21 giugno, 23:59»: the last moment to cancel (Europe/Rome). */
  scadenza: string | null;
  scadenzaIso: string | null;
  /** Why the action is missing; null when it is offered (or needs no words). */
  motivoTesto: string | null;
  /** Listed in the dialog. */
  conseguenze: string[];
};

export function toAnnullamentoView(
  {
    iscrizioneId,
    tappaId,
    nome,
    posto,
    categoria,
    stato,
    inGirone,
    tappa,
  }: {
    iscrizioneId: string;
    tappaId: string;
    nome: string;
    posto: number | null;
    categoria: Categoria;
    stato: StatoIscrizione;
    inGirone: boolean;
    tappa: TappaAnnullabile;
  },
  at: Date,
): AnnullamentoView {
  const esito = puoAnnullare({ stato, inGirone, tappa }, at);
  return {
    iscrizioneId,
    tappaId,
    tappa: nome,
    posto,
    categoria,
    possibile: esito.possibile,
    motivo: esito.possibile ? null : esito.motivo,
    scadenza: esito.scadenza ? formatScadenza(esito.scadenza) : null,
    scadenzaIso: esito.scadenza,
    motivoTesto: esito.possibile
      ? null
      : testoNonAnnullabile(esito.motivo, esito.scadenza),
    conseguenze: conseguenzeAnnullamento({
      posto,
      tabellone: nelTabellone(categoria),
    }),
  };
}
