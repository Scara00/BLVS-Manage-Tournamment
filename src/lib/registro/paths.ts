import { filtriQuery } from "./filtri";
import type { FiltriRegistro } from "./types";

/** w-admin-registro of a stage, with the filters in the query string. */
export function registroPath(id: string, filtri?: FiltriRegistro): string {
  const base = `/admin/tappe/${encodeURIComponent(id)}/registro`;
  const query = filtri ? filtriQuery(filtri) : "";
  return query ? `${base}?${query}` : base;
}
