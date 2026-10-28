/**
 * Rules still waiting for the client's answer (R-46). The rules page shows
 * «da confermare» next to each section listed here: when the client
 * confirms a rule, remove its entry here only.
 */
export type SezioneRegole =
  "formato" | "set" | "spareggi_girone" | "punti" | "spareggi_generale";

export type DomandaAperta = "Q-01" | "Q-03" | "Q-04" | "Q-06";

export const REGOLE_APERTE: Readonly<Record<DomandaAperta, SezioneRegole>> = {
  "Q-01": "formato",
  "Q-03": "spareggi_girone",
  "Q-04": "set",
  "Q-06": "spareggi_generale",
};

/** Whether `sezione` has a rule still to be confirmed. */
export function daConfermare(
  sezione: SezioneRegole,
  aperte: Readonly<
    Partial<Record<DomandaAperta, SezioneRegole>>
  > = REGOLE_APERTE,
): boolean {
  return Object.values(aperte).includes(sezione);
}
