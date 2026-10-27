import type AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Base UI portals (Dialog, AlertDialog, Toast) mount here, outside the story root. */
export const PORTAL_SELECTOR = "[data-base-ui-portal]";

/** Opens a story in the bare iframe and waits until it has rendered and settled. */
export async function gotoStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await page.locator("#storybook-root > *").first().waitFor();
  await waitForAnimations(page);
}

/**
 * Waits for finite CSS animations and transitions (dialog fade/zoom, toast
 * slide-in): axe would otherwise measure contrast mid-fade. Infinite ones,
 * like the loading spinner, are skipped.
 */
export async function waitForAnimations(page: Page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
}

/** Scopes axe to the story root plus any open overlay portal. */
export async function storyScope(page: Page) {
  const hasPortal = (await page.locator(PORTAL_SELECTOR).count()) > 0;
  return (builder: AxeBuilder) => {
    builder.include("#storybook-root");
    return hasPortal ? builder.include(PORTAL_SELECTOR) : builder;
  };
}
