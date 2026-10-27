import {
  ETICHETTE_EVENTO_REGISTRO,
  TIPI_EVENTO_REGISTRO,
  type TipoEventoRegistro,
} from "@/lib/audit";
import { isUuid } from "@/lib/api/validation";
import type { FiltriRegistro, PartitaFiltro } from "./types";

export const NESSUN_FILTRO: FiltriRegistro = { tipo: null, partita: null };

type Params =
  URLSearchParams | Record<string, string | string[] | undefined> | undefined;

function primo(params: Params, key: string): string | undefined {
  if (!params) return undefined;
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function isTipoEvento(value: unknown): value is TipoEventoRegistro {
  return (
    typeof value === "string" &&
    (TIPI_EVENTO_REGISTRO as readonly string[]).includes(value)
  );
}

/**
 * `?tipo=<tipo_evento_registro>&partita=<uuid>`. Unknown values are
 * dropped, so a stale or hand-edited link still opens the whole log.
 */
export function parseFiltri(params: Params): FiltriRegistro {
  const tipo = primo(params, "tipo");
  const partita = primo(params, "partita");
  return {
    tipo: isTipoEvento(tipo) ? tipo : null,
    partita: partita && isUuid(partita) ? partita : null,
  };
}

export function filtriQuery(filtri: FiltriRegistro): string {
  const params = new URLSearchParams();
  if (filtri.tipo) params.set("tipo", filtri.tipo);
  if (filtri.partita) params.set("partita", filtri.partita);
  return params.toString();
}

export function filtriAttivi(filtri: FiltriRegistro): boolean {
  return filtri.tipo !== null || filtri.partita !== null;
}

/** Same rule as `registro_tappa()`, for the demo store and the tests. */
export function applicaFiltri<
  T extends { tipo: TipoEventoRegistro; partitaId: string | null },
>(voci: readonly T[], filtri: FiltriRegistro): T[] {
  return voci.filter(
    (v) =>
      (filtri.tipo === null || v.tipo === filtri.tipo) &&
      (filtri.partita === null || v.partitaId === filtri.partita),
  );
}

/** Options of the «Tipo» filter, in the order of the enum. */
export const OPZIONI_TIPO: readonly {
  value: TipoEventoRegistro;
  label: string;
}[] = TIPI_EVENTO_REGISTRO.map((value) => ({
  value,
  label: ETICHETTE_EVENTO_REGISTRO[value],
}));

/**
 * «Correzione punteggio · Girone A, turno 2», or null without filters:
 * the summary above the list and the empty state.
 */
export function descriviFiltri(
  filtri: FiltriRegistro,
  partite: readonly PartitaFiltro[],
): string | null {
  const parti: string[] = [];
  if (filtri.tipo) parti.push(ETICHETTE_EVENTO_REGISTRO[filtri.tipo]);
  if (filtri.partita) {
    parti.push(
      partite.find((p) => p.id === filtri.partita)?.etichetta ??
        "Partita non più presente",
    );
  }
  return parti.length > 0 ? parti.join(" · ") : null;
}
