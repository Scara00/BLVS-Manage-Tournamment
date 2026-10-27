import { VOCI_PER_PAGINA } from "./messages";
import type { PaginaRegistro } from "./types";

/**
 * Appends an older page. Entries already shown are skipped (e.g. a double
 * click), and what is left to load comes from the new page.
 */
export function unisciPagina(
  attuale: PaginaRegistro,
  precedente: PaginaRegistro,
): PaginaRegistro {
  const visti = new Set(attuale.voci.map((v) => v.id));
  return {
    voci: [...attuale.voci, ...precedente.voci.filter((v) => !visti.has(v.id))],
    restanti: precedente.restanti,
  };
}

/** Cursor of the next request: the oldest entry shown. */
export function cursorePrecedenti(pagina: PaginaRegistro): number | null {
  if (pagina.restanti === 0) return null;
  return pagina.voci.at(-1)?.id ?? null;
}

/** How many the next click loads. */
export function prossimeVoci(restanti: number): number {
  return Math.min(restanti, VOCI_PER_PAGINA);
}

/** «Mostra le 12 voci precedenti», «Mostra la voce precedente». */
export function etichettaPrecedenti(restanti: number): string {
  const n = prossimeVoci(restanti);
  return n === 1
    ? "Mostra la voce precedente"
    : `Mostra le ${n} voci precedenti`;
}

/** Announced after a load: «Caricate 12 voci precedenti». */
export function annuncioPrecedenti(caricate: number, restanti: number): string {
  const testo =
    caricate === 1
      ? "Caricata 1 voce precedente."
      : `Caricate ${caricate} voci precedenti.`;
  return restanti === 0 ? `${testo} Non ci sono altre voci.` : testo;
}
