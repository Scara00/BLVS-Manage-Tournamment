/** The player's registrations (w-mie-iscrizioni, BLVS-51). */
export const MIE_ISCRIZIONI_PATH = "/iscrizioni";

/** Anchor of one registration on w-mie-iscrizioni. */
export function iscrizioneAncora(id: string): string {
  return `iscrizione-${id}`;
}
