import { isRegolaBlocco, type ProblemaAvvio } from "./regole";

/** A row of `controlli_avvio_fase`, or an item of `avvio_bloccato`'s detail. */
export type ProblemaDb = {
  regola: string;
  girone_id: string | null;
  girone_nome: string | null;
  dettaglio: string | null;
};

export function toProblemi(rows: readonly ProblemaDb[]): ProblemaAvvio[] {
  return rows
    .filter((r) => isRegolaBlocco(r.regola))
    .map((r) => ({
      regola: r.regola as ProblemaAvvio["regola"],
      gironeId: r.girone_id ?? null,
      gironeNome: r.girone_nome ?? null,
      dettaglio: r.dettaglio ?? null,
    }));
}

/** The JSON list `avvia_fase` puts in the detail of `avvio_bloccato`. */
export function problemiDaDettaglio(
  dettaglio: string | null | undefined,
): ProblemaAvvio[] {
  try {
    const rows: unknown = JSON.parse(dettaglio ?? "[]");
    return Array.isArray(rows) ? toProblemi(rows as ProblemaDb[]) : [];
  } catch {
    return [];
  }
}
