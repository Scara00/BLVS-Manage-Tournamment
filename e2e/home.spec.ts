import { expect, expectNoA11yViolations, test } from "./fixtures";

test("la home mostra il titolo e la lingua italiana", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("BLVS – Manage Tournament");
  await expect(page.locator("html")).toHaveAttribute("lang", "it");
  await expect(
    page.getByRole("heading", { level: 1, name: "BLVS – Manage Tournament" }),
  ).toBeVisible();
});

test("la home rispetta WCAG 2.2 AA", async ({ page }) => {
  await page.goto("/");
  await expectNoA11yViolations(page);
});

test("le risposte non forzano HSTS in locale ma hanno gli header di sicurezza", async ({
  request,
}) => {
  const res = await request.get("/");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["strict-transport-security"]).toBeUndefined();
});
