import type { Categoria } from "@/lib/db/types";

export const NUOVA_TAPPA_PATH = "/admin/tappe/nuova";
/** Where the admin lands once the stage is created. */
export const TAPPA_CREATA_HREF = "/admin";

export const POSTI_MIN = 4;
export const POSTI_MAX = 256;
export const POSTI_PREDEFINITI = 16;

export const CAMPI_NUOVA_TAPPA = [
  "nome",
  "luogo",
  "data",
  "scadenza",
  "postiM",
  "postiF",
] as const;
export type CampoNuovaTappa = (typeof CAMPI_NUOVA_TAPPA)[number];

/** The form field holding the maximum of each board. */
export const CAMPO_POSTI: Record<Categoria, "postiM" | "postiF"> = {
  M: "postiM",
  F: "postiF",
};

export type NuovaTappaValori = {
  nome: string;
  luogo: string;
  /** `YYYY-MM-DD`, the single day of play. */
  data: string;
  /** Registration deadline, as an ISO instant. */
  scadenza: string;
  postiM: number;
  postiF: number;
};

/** Result of `creaTappa`, the w-admin-tappa-nuova server action. */
export type NuovaTappaFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fields: Partial<Record<CampoNuovaTappa, string>>;
    }
  | { status: "success"; message: string; id: string; href: string }
  | { status: "sessionExpired"; message: string }
  | { status: "permissionDenied"; message: string }
  | { status: "unavailable"; message: string };

export const initialNuovaTappaFormState: NuovaTappaFormState = {
  status: "idle",
};

export type NuovaTappaAction = (
  prevState: NuovaTappaFormState,
  formData: FormData,
) => Promise<NuovaTappaFormState>;

export const NUOVA_TAPPA_MESSAGES = {
  invalid: "Controlla i campi evidenziati.",
  created: "Tappa creata in bozza.",
  sessionExpired:
    "La sessione è scaduta: accedi di nuovo per creare la tappa. I dati inseriti restano in bozza su questo dispositivo.",
  permissionDenied: "Solo l'amministrazione può creare una tappa.",
  unavailable:
    "Salvataggio non disponibile: il database non è configurato in questo ambiente.",
  failed: "Creazione non riuscita. Riprova più tardi.",
  dataPassata: "La data della tappa deve essere futura.",
  scadenzaPassata: "La scadenza delle iscrizioni deve essere futura.",
  scadenzaDopoTappa: "La scadenza deve precedere la data della tappa.",
  oraInesistente:
    "Quest'ora non esiste per il passaggio all'ora legale: scegline un'altra.",
  dataNonValida: "Data non valida.",
  scadenzaNonValida: "Data e ora non valide.",
  posti: `Inserisci un numero intero tra ${POSTI_MIN} e ${POSTI_MAX}.`,
} as const;

/** Warning shown next to a maximum that leaves incomplete groups. */
export function avvisoGironiMessage(
  posti: number,
  dimensione: number,
  categoria: Categoria,
): string {
  const tabellone = categoria === "M" ? "maschile" : "femminile";
  return `Tabellone ${tabellone}: con ${posti} iscritti i gironi da ${dimensione} non sono completi in tutte le fasi.`;
}
