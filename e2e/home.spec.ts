import { expect, test } from "@playwright/test";

test("la home mostra il titolo e la lingua italiana", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("BLVS – Manage Tournament");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(
    page.getByRole("heading", { level: 1, name: "BLVS – Manage Tournament" }),
  ).toBeVisible();
});
