/**
 * The /…/anteprima/* routes trigger the error pages on purpose. They exist in
 * development and in e2e (`ERROR_PREVIEWS=true`), never in a production build.
 */
export function isErrorPreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ERROR_PREVIEWS === "true"
  );
}
