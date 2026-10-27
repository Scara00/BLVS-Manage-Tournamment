import type { IscrittiTappaView } from "./types";

/**
 * Registrants export. Excel in Italian locale expects `;` and reads UTF-8
 * only with a BOM, so accented names survive a double click. Lines end in
 * CRLF (RFC 4180).
 */
export const CSV_SEPARATOR = ";";
export const CSV_BOM = "﻿";
export const CSV_HEADER = [
  "Categoria",
  "Posto",
  "Cognome e nome",
  "Email",
  "Stato",
  "Iscritto il",
] as const;

/**
 * A field quoted when it holds the separator, a quote or a line break.
 * Values that a spreadsheet would run as a formula (`= + - @`, tab, CR)
 * get a leading apostrophe, so a name like «=HYPERLINK(…)» stays text.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function csvLine(fields: readonly string[]): string {
  return fields.map(csvField).join(CSV_SEPARATOR);
}

/** Every active registrant of the stage, by board (M then F) and seat. */
export function iscrittiCsv(tappa: IscrittiTappaView): string {
  const lines = [csvLine(CSV_HEADER)];
  for (const tabellone of tappa.tabelloni) {
    for (const iscritto of tabellone.iscritti) {
      lines.push(
        csvLine([
          tabellone.label,
          iscritto.posto === null ? "" : String(iscritto.posto),
          iscritto.nome,
          iscritto.email,
          iscritto.statoLabel,
          iscritto.iscrittoIlTesto,
        ]),
      );
    }
  }
  return `${CSV_BOM}${lines.join("\r\n")}\r\n`;
}

function slug(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tappa"
  );
}

/** «iscritti-tappa-2-rimini.csv»: ASCII only, safe in any header. */
export function csvFilename(tappa: { nome: string }): string {
  return `iscritti-${slug(tappa.nome)}.csv`;
}
