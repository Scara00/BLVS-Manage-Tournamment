/** Plain module: no react-email import, so client components can use it. */
export const confermaEmailSubject = "Conferma il tuo indirizzo email · BLVS";

/**
 * Copy of the email, shared with the non-interactive preview on the
 * «Conferma email» page (src/components/email-verify/email-preview.tsx).
 */
export const confermaEmailCopy = {
  heading: "Conferma il tuo indirizzo email",
  intro:
    "Ti diamo il benvenuto su BLVS! Per attivare l'account e iscriverti alle tappe, conferma che questo indirizzo è tuo.",
  validity: (minutes: number) =>
    `Il link è valido per ${minutes} minuti e si può usare una sola volta. Se ne chiedi un altro, questo smette di funzionare.`,
  action: "Conferma email",
} as const;
