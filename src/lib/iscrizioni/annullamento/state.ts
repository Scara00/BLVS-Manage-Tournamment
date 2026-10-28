/** State of the cancel form (plain module: client components import it). */
export type AnnullaIscrizioneState =
  | { status: "idle" }
  | {
      status: "error";
      reason: "sessionExpired" | "refused" | "notFound" | "network" | "unknown";
      message: string;
      attempt: number;
    }
  | {
      status: "success";
      tappaId: string;
      posto: number | null;
      /** «Iscrizione a Tappa 2 · Rimini annullata: il posto 12 è di nuovo libero.» */
      message: string;
      attempt: number;
    };

export const ANNULLA_ISCRIZIONE_INITIAL: AnnullaIscrizioneState = {
  status: "idle",
};

export type AnnullaIscrizioneAction = (
  prev: AnnullaIscrizioneState,
  formData: FormData,
) => Promise<AnnullaIscrizioneState>;

export function prossimoTentativo(prev: AnnullaIscrizioneState): number {
  return prev.status === "idle" ? 1 : prev.attempt + 1;
}

/** The success message, said once and shown where the action was. */
export function messaggioAnnullata(tappa: string, posto: number | null) {
  return posto
    ? `Iscrizione a ${tappa} annullata: il posto ${posto} è di nuovo libero.`
    : `Iscrizione a ${tappa} annullata: il posto è di nuovo libero.`;
}
