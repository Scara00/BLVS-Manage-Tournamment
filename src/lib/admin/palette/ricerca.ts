import type { AdminTappa } from "@/lib/admin/tappe";
import { CLASSIFICA_PATH } from "@/lib/navigation/auth-paths";
import { gestioneTappaPath } from "@/lib/tappe/gestione-state";
import { STATO_TAPPA_LABEL } from "@/lib/tappe/format";
import {
  GRUPPI_PALETTE,
  type GruppoPalette,
  type RisultatoPalette,
  type TipoRisultato,
} from "./types";

/** Results shown per group: the palette is a jump list, not a report. */
export const PALETTE_MAX_PER_GRUPPO = 5;

export const ETICHETTA_GRUPPO: Record<TipoRisultato, string> = {
  tappa: "Tappe",
  giocatore: "Giocatori",
  partita: "Partite",
  comando: "Comandi",
};

/** Lower case, without accents: «Niccolò» is found by «nicco». */
export function normalizza(testo: string): string {
  return testo.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("it");
}

/** Every word is somewhere in one of the texts (accents and case ignored). */
export function corrisponde(
  parole: readonly string[],
  testi: readonly string[],
): boolean {
  const testo = normalizza(testi.join(" "));
  return parole.every((parola) => testo.includes(normalizza(parola)));
}

/** Admin pages and actions, always one Enter away. */
export const COMANDI_PALETTE: readonly RisultatoPalette[] = [
  {
    tipo: "comando",
    id: "dashboard",
    titolo: "Vai alla dashboard",
    dettaglio: "Riepilogo del circuito",
    href: "/admin",
  },
  {
    tipo: "comando",
    id: "tappe",
    titolo: "Vai alle tappe",
    dettaglio: "Calendario e gestione delle tappe",
    href: "/admin/tappe",
  },
  {
    tipo: "comando",
    id: "nuova-tappa",
    titolo: "Nuova tappa",
    dettaglio: "Crea una tappa in bozza",
    href: "/admin/tappe/nuova",
  },
  {
    tipo: "comando",
    id: "iscrizioni",
    titolo: "Vai alle iscrizioni",
    dettaglio: "Iscrizioni da approvare",
    href: "/admin/iscrizioni",
  },
  {
    tipo: "comando",
    id: "giocatori",
    titolo: "Vai ai giocatori",
    dettaglio: "Anagrafica dei giocatori",
    href: "/admin/giocatori",
  },
];

/** The commands matching the query; all of them for an empty query. */
export function cercaComandi(parole: readonly string[]): RisultatoPalette[] {
  return COMANDI_PALETTE.filter((c) =>
    corrisponde(parole, [c.titolo, c.dettaglio]),
  );
}

/** Stages by name or state, as w-admin-dashboard lists them. */
export function cercaTappe(
  tappe: readonly AdminTappa[],
  parole: readonly string[],
  limite = PALETTE_MAX_PER_GRUPPO,
): RisultatoPalette[] {
  if (parole.length === 0) return [];
  return tappe
    .filter((t) => corrisponde(parole, [t.nome, STATO_TAPPA_LABEL[t.stato]]))
    .slice(0, limite)
    .map((t) => ({
      tipo: "tappa",
      id: t.id,
      titolo: t.nome,
      dettaglio: `${t.periodo} · ${STATO_TAPPA_LABEL[t.stato]}`,
      href: gestioneTappaPath(t.id),
    }));
}

/**
 * A player's public card (w-giocatore, client decision): with a category
 * it opens that standing, otherwise the card picks one itself.
 */
export function schedaGiocatoreHref(
  utenteId: string,
  categoria: "M" | "F" | null,
): string {
  const base = `${CLASSIFICA_PATH}/giocatore/${encodeURIComponent(utenteId)}`;
  return categoria ? `${base}?categoria=${categoria}` : base;
}

/** The non-empty groups, in the order of `GRUPPI_PALETTE`. */
export function raggruppa(
  risultati: Partial<Record<TipoRisultato, readonly RisultatoPalette[]>>,
): GruppoPalette[] {
  return GRUPPI_PALETTE.flatMap((tipo) => {
    const lista = risultati[tipo] ?? [];
    return lista.length > 0
      ? [{ tipo, etichetta: ETICHETTA_GRUPPO[tipo], risultati: [...lista] }]
      : [];
  });
}

/** The options in reading order, across groups (for the arrow keys). */
export function opzioni(gruppi: readonly GruppoPalette[]): RisultatoPalette[] {
  return gruppi.flatMap((g) => g.risultati);
}

/** A stable DOM id for an option (aria-activedescendant). */
export function idOpzione(prefisso: string, r: RisultatoPalette): string {
  return `${prefisso}-${r.tipo}-${r.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

/** «Nessun risultato», «1 risultato», «7 risultati». */
export function annuncioRisultati(n: number): string {
  if (n === 0) return "Nessun risultato";
  return n === 1 ? "1 risultato" : `${n} risultati`;
}
