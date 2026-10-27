/** Support code for a failed render: `ERR-503`, plus the server digest if any. */
export function errorCode(error: unknown, prefix = "ERR-503"): string {
  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : null;
  return digest ? `${prefix}-${digest}` : prefix;
}
