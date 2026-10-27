import { CATEGORIE, type Categoria } from "@/lib/db/types";

/** What survives a reload or a trip to the privacy notice: never the password. */
export type SignupDraft = {
  nome: string;
  cognome: string;
  email: string;
  categoria: Categoria | "";
  consensoPrivacy: boolean;
};

export const EMPTY_DRAFT: SignupDraft = {
  nome: "",
  cognome: "",
  email: "",
  categoria: "",
  consensoPrivacy: false,
};

export const SIGNUP_DRAFT_KEY = "blvs:registrati:bozza";

/** Storage can be missing or throw (private mode, blocked site data). */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Reads the draft back, ignoring anything malformed. */
export function readSignupDraft(): SignupDraft {
  try {
    const raw = storage()?.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return EMPTY_DRAFT;
    const d = data as Record<string, unknown>;
    return {
      nome: text(d.nome, 200),
      cognome: text(d.cognome, 200),
      email: text(d.email, 254),
      categoria: CATEGORIE.includes(d.categoria as Categoria)
        ? (d.categoria as Categoria)
        : "",
      consensoPrivacy: d.consensoPrivacy === true,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveSignupDraft(draft: SignupDraft): void {
  try {
    const { nome, cognome, email, categoria, consensoPrivacy } = draft;
    storage()?.setItem(
      SIGNUP_DRAFT_KEY,
      JSON.stringify({ nome, cognome, email, categoria, consensoPrivacy }),
    );
  } catch {
    // Full or blocked storage: the form still works, it just won't remember.
  }
}

export function clearSignupDraft(): void {
  try {
    storage()?.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}
