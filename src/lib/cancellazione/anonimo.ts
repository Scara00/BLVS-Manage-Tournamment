/**
 * BLVS-53 · What a deleted account becomes. The server writes the
 * placeholder into `utenti.nome` / `utenti.cognome` (SQL
 * `public.nome_anonimo()`, migration `20261027460000_giocatore_anonimo`),
 * so every reader of names shows it unchanged. A PGlite test compares the two.
 */
export const NOME_ANONIMO = { nome: "Giocatore", cognome: "anonimo" } as const;

/** «Giocatore anonimo»: the public name of a deleted account. */
export const GIOCATORE_ANONIMO = `${NOME_ANONIMO.nome} ${NOME_ANONIMO.cognome}`;

/** The word the player types to confirm the deletion. */
export const PAROLA_CONFERMA = "ELIMINA";

/** Whether `valore` is the confirmation word (spaces and case ignored). */
export function confermaValida(valore: unknown): boolean {
  return (
    typeof valore === "string" &&
    valore.trim().toUpperCase() === PAROLA_CONFERMA
  );
}
