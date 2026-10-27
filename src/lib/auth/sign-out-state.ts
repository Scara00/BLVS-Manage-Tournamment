/**
 * Result of the «Esci» server action, kept outside the "use server" module
 * so client components can import it. On success the action redirects, so
 * only the failure carries data.
 */
export type SignOutState = { error: string | null };

export const initialSignOutState: SignOutState = { error: null };

export const SIGN_OUT_ERROR_MESSAGE = "Non è stato possibile uscire. Riprova.";
