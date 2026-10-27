/**
 * Event types of the race log (`public.tipo_evento_registro`). The order and
 * the values must match the enum in
 * supabase/migrations/20261027200000_registro_eventi.sql, plus the values
 * added later at the end (a test checks it).
 */
export const TIPI_EVENTO_REGISTRO = [
  "inserimento_punteggio",
  "correzione_punteggio",
  "annullamento_punteggio",
  "ritiro",
  "assenza",
  "parita_risolta",
  "rigenerazione_gironi",
  "cambio_categoria",
  "chiusura_tabellone",
  // BLVS-37 (20261027400000_punteggio_parziale_evento.sql).
  "punteggio_parziale",
] as const;

export type TipoEventoRegistro = (typeof TIPI_EVENTO_REGISTRO)[number];

/** Italian labels, for the admin log view and exports. */
export const ETICHETTE_EVENTO_REGISTRO: Record<TipoEventoRegistro, string> = {
  inserimento_punteggio: "Inserimento punteggio",
  correzione_punteggio: "Correzione punteggio",
  annullamento_punteggio: "Annullamento punteggio",
  ritiro: "Ritiro",
  assenza: "Assenza",
  parita_risolta: "Parità risolta",
  rigenerazione_gironi: "Rigenerazione dei gironi",
  cambio_categoria: "Cambio di categoria",
  chiusura_tabellone: "Chiusura del tabellone",
  punteggio_parziale: "Punteggio parziale",
};
