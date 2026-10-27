import { SERVER_LOCALE, SERVER_TIME_ZONE } from "@/lib/time/server-time";

/**
 * Version of the «Informativa privacy» currently in force. Registration
 * (BLVS-12) stores both fields with the user's consent, so bump them every
 * time the text in `src/components/privacy/privacy-policy.tsx` changes in
 * substance.
 */
export const PRIVACY_POLICY_VERSION = {
  number: "1.0",
  /** ISO date (YYYY-MM-DD) from which this version applies. */
  date: "2026-10-27",
} as const;

export type PrivacyPolicyVersion = {
  number: string;
  date: string;
};

/**
 * Data controller shown on the page.
 * TODO(cliente): replace with the details in the client's approved text.
 */
export const PRIVACY_CONTROLLER = {
  name: "BLVS – Beach Volley Series A.S.D.",
  address: "Via del Lungomare 1, 47921 Rimini (RN)",
  email: "privacy@blvs.example",
} as const;

export type PrivacySection = { id: string; title: string };

/** Order of the index and of the sections on the page. */
export const privacySections = [
  { id: "titolare", title: "Titolare e contatti" },
  { id: "dati-raccolti", title: "Quali dati raccogliamo" },
  { id: "finalita-base-giuridica", title: "Finalità e base giuridica" },
  { id: "cosa-e-pubblico", title: "Cosa compare in classifiche e pagine live" },
  { id: "conservazione-cancellazione", title: "Conservazione e cancellazione" },
  { id: "diritti", title: "I tuoi diritti" },
  { id: "modifiche", title: "Modifiche e versione" },
] as const satisfies readonly PrivacySection[];

export type PrivacySectionId = (typeof privacySections)[number]["id"];

const dateFormatter = new Intl.DateTimeFormat(SERVER_LOCALE, {
  timeZone: SERVER_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** «27 ottobre 2026». Noon UTC keeps the same calendar day in Rome. */
export function formatPolicyDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}
