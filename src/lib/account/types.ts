/** Account deletion (BLVS-50, R-79): the player's own request on w-profilo. */

export type CancellaAccountState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sessionExpired"; message: string };

export type CancellaAccountAction = (
  prevState: CancellaAccountState,
  formData: FormData,
) => Promise<CancellaAccountState>;

export const initialCancellaAccountState: CancellaAccountState = {
  status: "idle",
};

export const CANCELLA_ACCOUNT_MESSAGES = {
  conferma: "Spunta la casella per confermare che vuoi cancellare l'account.",
  accountAdmin:
    "Un account dell'organizzazione non si cancella da qui: chiedi a un altro admin di toglierti il ruolo.",
  tappaInCorso:
    "Hai una tappa in corso: potrai cancellare l'account quando sarà finita.",
  failed:
    "Non è stato possibile cancellare l'account. Riprova tra qualche minuto.",
  sessionExpired: "La sessione è scaduta: accedi di nuovo per continuare.",
} as const;

/** `hint` of `public.cancella_account()` → the message shown. */
export function messaggioCancellazione(hint: string | undefined): string {
  if (hint === "account_admin") return CANCELLA_ACCOUNT_MESSAGES.accountAdmin;
  if (hint === "tappa_in_corso") return CANCELLA_ACCOUNT_MESSAGES.tappaInCorso;
  return CANCELLA_ACCOUNT_MESSAGES.failed;
}
