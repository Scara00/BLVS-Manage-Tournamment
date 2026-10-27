import { controllaGironi } from "./controlli";
import {
  nomeDestinazione,
  posizioneGiocatore,
  prossimoNomeGirone,
  trovaGiocatore,
} from "./operazioni";
import {
  NON_ASSEGNATI,
  type ComposizioneGironi,
  type Destinazione,
  type OperazioneGironi,
} from "./types";

function verso(c: ComposizioneGironi, d: Destinazione) {
  return d === NON_ASSEGNATI
    ? "tra i non assegnati"
    : `nel ${nomeDestinazione(c, d)}`;
}

/**
 * What a change did, in words, read from the groups BEFORE it: «Mario
 * Rossi spostato nel Girone C.». The editor announces it, followed by
 * the checks of the groups after it (`annuncioModifica`).
 */
export function descriviOperazione(
  prima: ComposizioneGironi,
  operazione: OperazioneGironi,
): string {
  switch (operazione.tipo) {
    case "sposta": {
      const g = trovaGiocatore(prima, operazione.iscrizioneId);
      return `${g?.nome ?? "Giocatore"} spostato ${verso(prima, operazione.verso)}.`;
    }
    case "scambia": {
      const a = trovaGiocatore(prima, operazione.a);
      const b = trovaGiocatore(prima, operazione.b);
      const da = posizioneGiocatore(prima, operazione.a) ?? NON_ASSEGNATI;
      const db = posizioneGiocatore(prima, operazione.b) ?? NON_ASSEGNATI;
      return `Scambiati ${a?.nome} e ${b?.nome}: ${a?.nome} ora è ${verso(prima, db)}, ${b?.nome} ${verso(prima, da)}.`;
    }
    case "aggiungi":
      return `${prossimoNomeGirone(prima.gironi)} aggiunto.`;
    case "elimina": {
      const girone = prima.gironi.find((g) => g.id === operazione.gironeId);
      const n = girone?.giocatori.length ?? 0;
      const resto =
        n === 0
          ? ""
          : n === 1
            ? " 1 giocatore è passato tra i non assegnati."
            : ` ${n} giocatori sono passati tra i non assegnati.`;
      return `${girone?.nome ?? "Girone"} eliminato.${resto}`;
    }
  }
}

/** The full announcement: the change, then the checks after it. */
export function annuncioModifica(
  prima: ComposizioneGironi,
  dopo: ComposizioneGironi,
  operazione: OperazioneGironi,
): string {
  return `${descriviOperazione(prima, operazione)} ${controllaGironi(dopo).riepilogo}`;
}
