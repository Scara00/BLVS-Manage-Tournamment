type ErroreDb = {
  code?: string;
  hint?: string | null;
  detail?: string | null;
};

/**
 * A save refused because the score changed after it was read: SQLSTATE
 * 40001 with hint `punteggio_cambiato`. `detail` carries the current
 * version (a number, or JSON with `versione`); null when it is unreadable.
 * Returns undefined for any other error.
 */
export function versioneDaConflitto(
  error: ErroreDb,
): number | null | undefined {
  if (error.code !== "40001" && error.hint !== "punteggio_cambiato") {
    return undefined;
  }
  const detail = error.detail?.trim();
  if (!detail) return null;
  const numero = Number(detail);
  if (Number.isInteger(numero) && numero >= 1) return numero;
  try {
    const parsed: unknown = JSON.parse(detail);
    if (
      parsed &&
      typeof parsed === "object" &&
      "versione" in parsed &&
      Number.isInteger(parsed.versione)
    ) {
      return parsed.versione as number;
    }
  } catch {
    // Not JSON: the version is unknown, the caller re-reads the row.
  }
  return null;
}
