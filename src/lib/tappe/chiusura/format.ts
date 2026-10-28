import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import type { CambioPunti } from "./punti";
import type { BloccoChiusura } from "./regole";

/** What closing does, said in the confirmation dialog. */
export const EFFETTO_CHIUSURA =
  "I punti diventano definitivi e la classifica generale si aggiorna.";

export const CHIUSURA_MESSAGES = {
  concluso: "Il tabellone è già concluso.",
  fase: "Il tabellone si conclude dopo le finali gold e silver.",
  conflict:
    "Il tabellone è cambiato nel frattempo: ricarica la pagina e riprova.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può concludere un tabellone.",
  network:
    "Non è stato possibile concludere: controlla la connessione e riprova.",
  offline:
    "Sei offline: potrai concludere il tabellone quando la connessione torna.",
  tappaArchiviata: "La tappa è archiviata: i dati non si modificano più.",
} as const;

const partiteLabel = (n: number) =>
  n === 1 ? "1 partita non è conclusa" : `${n} partite non sono concluse`;

/** The block as one sentence, always as text. */
export function descriviBlocco(blocco: BloccoChiusura): string {
  switch (blocco.motivo) {
    case "concluso":
      return CHIUSURA_MESSAGES.concluso;
    case "tappa":
      return `La tappa è «${STATO_TAPPA_LABEL[blocco.stato].toLowerCase()}»: si conclude un tabellone solo con la tappa in corso.`;
    case "fase":
      return CHIUSURA_MESSAGES.fase;
    case "partite":
      return `Non si può concludere: ${partiteLabel(blocco.daConcludere)} con una squadra vincente.`;
    case "parita": {
      const nomi = blocco.finali.map((f) => f.nome).join(" e ");
      return `Non si può concludere: c'è una parità da risolvere${nomi ? ` (${nomi})` : ""}.`;
    }
  }
}

/** Success, said in the page and announced. */
export function messaggioChiusura(
  categoriaLabel: string,
  tappaConclusa: boolean,
): string {
  const base = `Tabellone ${categoriaLabel} concluso: i punti sono definitivi.`;
  return tappaConclusa
    ? `${base} Entrambi i tabelloni sono conclusi: la tappa è conclusa e si può archiviare.`
    : base;
}

const puntiLabel = (punti: number | null) =>
  punti === null ? "senza punti" : punti === 1 ? "1 punto" : `${punti} punti`;

/** «Luca Rossi: 2° con 8 punti → 1° con 12 punti». */
export function descriviCambio(c: CambioPunti): string {
  const lato = (v: CambioPunti["prima"]) =>
    v ? `${v.posizione}° con ${puntiLabel(v.punti)}` : "fuori classifica";
  return `${c.nome}: ${lato(c.prima)} → ${lato(c.dopo)}`;
}

/** Heading of the list in the correction confirmation. */
export function riepilogoCambi(cambi: readonly CambioPunti[]): string {
  if (cambi.length === 0) return "Nessun punto della tappa cambia.";
  return cambi.length === 1
    ? "Cambiano i punti di 1 giocatore."
    : `Cambiano i punti di ${cambi.length} giocatori.`;
}
