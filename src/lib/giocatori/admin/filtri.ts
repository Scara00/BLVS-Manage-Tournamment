import { paroleRicerca } from "@/lib/iscrizioni/admin/search";
import { GIOCATORI_ADMIN_PATH } from "./paths";

export const GIOCATORI_PER_PAGINA = 25;

export type FiltriGiocatori = {
  /** The search as typed (trimmed). */
  q: string;
  daVerificare: boolean;
  /** 1-based. */
  pagina: number;
};

const primo = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/** The GET form of w-admin-giocatori: `?q=&verifica=1&pagina=`. */
export function leggiFiltri(
  params: Record<string, string | string[] | undefined>,
): FiltriGiocatori {
  const pagina = Number.parseInt(primo(params.pagina), 10);
  return {
    q: primo(params.q).trim().slice(0, 100),
    daVerificare: primo(params.verifica) === "1",
    pagina: Number.isInteger(pagina) && pagina > 0 ? pagina : 1,
  };
}

/** The words the search runs on (none when too short). */
export function paroleFiltro(filtri: FiltriGiocatori): string[] {
  return paroleRicerca(filtri.q);
}

/** The list URL for `filtri`, defaults left out. */
export function filtriHref(filtri: Partial<FiltriGiocatori>): string {
  const params = new URLSearchParams();
  if (filtri.q) params.set("q", filtri.q);
  if (filtri.daVerificare) params.set("verifica", "1");
  if (filtri.pagina && filtri.pagina > 1) {
    params.set("pagina", String(filtri.pagina));
  }
  const query = params.toString();
  return query ? `${GIOCATORI_ADMIN_PATH}?${query}` : GIOCATORI_ADMIN_PATH;
}

/** True when a demo row matches every word, like the PostgREST filter. */
export function corrispondeRicerca(
  giocatore: { nome: string; cognome: string; email: string },
  parole: readonly string[],
): boolean {
  const testo = [giocatore.nome, giocatore.cognome, giocatore.email]
    .join(" ")
    .toLocaleLowerCase("it");
  return parole.every((p) => testo.includes(p.toLocaleLowerCase("it")));
}
