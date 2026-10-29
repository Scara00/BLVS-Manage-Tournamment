/** Copy of w-admin-iscritti / w-admin-aggiungi-giocatore (plain module). */
export const ISCRITTI_MESSAGES = {
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
  permissionDenied: "Solo l'amministrazione può gestire gli iscritti.",
  network: "Non è stato possibile salvare: controlla la connessione e riprova.",
  ricercaNonRiuscita:
    "La ricerca non è riuscita: controlla la connessione e riprova.",
  giaIscritto: "Il giocatore è già iscritto a questa tappa.",
  postiEsauriti:
    "Posti esauriti in questo tabellone: libera un posto prima di aggiungere.",
  categoriaMancante:
    "Il giocatore non ha ancora scelto la categoria nel profilo.",
  giocatoreNonTrovato: "Giocatore non trovato.",
  iscrizioneNonTrovata:
    "L'iscrizione non c'è più: forse è già stata rimossa. Ricarica la pagina.",
  tappaNonTrovata: "Tappa non trovata.",
  nonModificabile:
    "Con la tappa in corso o conclusa gli iscritti non cambiano più.",
  annullata: "La tappa è annullata: gli iscritti non cambiano più.",
  archiviata: "La tappa è archiviata: consultabile ma non modificabile.",
} as const;

/** Shortest query the player search runs. */
export const RICERCA_MIN_CARATTERI = 2;

/** Most results the search returns. */
export const RICERCA_MAX_RISULTATI = 20;

export function aggiuntoMessage(nome: string, posto: number | null): string {
  return posto === null
    ? `${nome} ora è tra gli iscritti.`
    : `${nome} ora ha il posto ${posto}.`;
}

/** After «Conferma» on a row; `confermate` 0 = it was already confirmed. */
export function confermataMessage(nome: string, confermate: number): string {
  return confermate === 0
    ? `L'iscrizione di ${nome} era già confermata.`
    : `Iscrizione di ${nome} confermata.`;
}

/** After «Conferma tutte». */
export function confermateMessage(confermate: number): string {
  if (confermate === 0) return "Nessuna iscrizione in attesa da confermare.";
  return confermate === 1
    ? "1 iscrizione confermata."
    : `${confermate} iscrizioni confermate.`;
}

export function rimossoMessage(nome: string, posto: number | null): string {
  return posto === null
    ? `Iscrizione di ${nome} rimossa.`
    : `Iscrizione di ${nome} rimossa: il posto ${posto} è di nuovo libero.`;
}
