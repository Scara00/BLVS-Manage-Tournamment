/** Copy of the admin session warning (BLVS-18). */
export const ADMIN_SESSION_MESSAGES = {
  title: "La sessione sta per scadere",
  expiredTitle: "Sessione scaduta",
  expiring: "Salvo le bozze e ti porto alla pagina di accesso…",
  intro: "Per sicurezza la sessione di amministrazione si chiude tra",
  saved:
    "Quello che hai già inviato è salvato. I moduli non ancora inviati restano in bozza su questo dispositivo e li ritrovi dopo il nuovo accesso.",
  signOutNote:
    "«Esci» chiude la sessione e cancella le bozze da questo dispositivo.",
  extend: "Prolunga sessione",
  extending: "Prolungamento…",
  signOut: "Esci",
  extendError: "Non è stato possibile prolungare la sessione. Riprova.",
  extendedTitle: "Sessione prolungata",
  extendedUntil: (time: string) => `Resti connesso fino alle ${time}.`,
} as const;

/** Polite announcement at a few milestones only, never every second. */
export function countdownMilestone(secondsLeft: number): string {
  if (secondsLeft <= 0) return "";
  if (secondsLeft <= 30)
    return "Mancano meno di 30 secondi alla chiusura della sessione.";
  if (secondsLeft <= 60)
    return "Manca meno di un minuto alla chiusura della sessione.";
  return "";
}
