import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * Without a session (here: no Supabase at all) the profile pages show the
 * «Sessione scaduta» panel inside the player shell. The signed-in flows run
 * against real Auth in e2e/supabase/profilo.spec.ts and on the stories.
 * NB: once BLVS-13's proxy guard is merged, signed-out visitors may be
 * redirected to the login page before reaching these pages.
 */
for (const { path, title, h1 } of [
  { path: "/profilo", title: "Profilo · BLVS", h1: "Il tuo profilo" },
  {
    path: "/profilo/modifica",
    title: "Modifica profilo · BLVS",
    h1: "Modifica profilo",
  },
]) {
  test(`${path}: senza sessione chiede di accedere di nuovo`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
    await expect(
      page.getByRole("heading", { level: 1, name: h1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Sessione scaduta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Accedi di nuovo" }),
    ).toHaveAttribute(
      "href",
      `/sessione-scaduta?da=${encodeURIComponent(path)}`,
    );
    await expectNoA11yViolations(page);
  });
}
