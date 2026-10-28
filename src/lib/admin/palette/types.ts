/** The kinds of result the command palette lists, in this order. */
export const GRUPPI_PALETTE = [
  "tappa",
  "giocatore",
  "partita",
  "comando",
] as const;

export type TipoRisultato = (typeof GRUPPI_PALETTE)[number];

/** One option of the palette: where Enter (or a tap) takes the admin. */
export type RisultatoPalette = {
  tipo: TipoRisultato;
  id: string;
  titolo: string;
  /** Second line: dates and state, email, group and turn… */
  dettaglio: string;
  href: string;
};

export type GruppoPalette = {
  tipo: TipoRisultato;
  etichetta: string;
  risultati: RisultatoPalette[];
};

/** What `cercaPalette` returns: stages, players and matches. */
export type EsitoPalette =
  | {
      status: "ok";
      tappe: RisultatoPalette[];
      giocatori: RisultatoPalette[];
      partite: RisultatoPalette[];
    }
  | { status: "error"; reason: "sessionExpired" | "network"; message: string };

export type CercaPaletteAction = (query: string) => Promise<EsitoPalette>;
