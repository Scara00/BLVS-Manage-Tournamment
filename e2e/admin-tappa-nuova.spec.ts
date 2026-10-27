import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * w-admin-tappa-nuova without Supabase (CI): the form validates on the
 * server action and answers «non disponibile» instead of saving. Creating
 * a real stage runs in the stories and in the DB tests (crea_tappa).
 */
const PATH = "/admin/tappe/nuova";

test.beforeEach(async ({ page }) => {
  await page.goto(PATH);
  // Static pages hydrate late: wait before using client-side handlers.
  await page.waitForLoadState("networkidle");
});

test("mostra il modulo nella shell admin senza violazioni", async ({
  page,
}) => {
  await expect(page).toHaveTitle("Nuova tappa · Amministrazione · BLVS");
  await expect(
    page.getByRole("heading", { level: 1, name: "Nuova tappa" }),
  ).toBeVisible();
  await expect(page.getByText(/in bozza/).first()).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: /tabellone maschile/ }),
  ).toHaveValue("16");
  await expect(
    page.getByRole("spinbutton", { name: /tabellone femminile/ }),
  ).toHaveValue("16");
  await expectNoA11yViolations(page);
});

test("gli errori compaiono accanto ai campi e il focus va al primo", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Crea tappa in bozza" }).click();

  const nome = page.getByLabel(/^Nome/);
  await expect(nome).toHaveAttribute("aria-invalid", "true");
  await expect(nome).toBeFocused();
  for (const label of [/^Nome/, /^Luogo/, /^Data/, /^Scadenza/]) {
    const campo = page.getByLabel(label);
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAccessibleDescription(/Campo obbligatorio/);
    // The error is the next message inside the same field.
    await expect(
      page
        .locator("[data-slot=field]", { has: campo })
        .locator("[data-slot=field-error]"),
    ).toHaveText(/Campo obbligatorio/);
  }
  await expectNoA11yViolations(page);
});

test("data passata e scadenza dopo la tappa", async ({ page }) => {
  await page.getByLabel(/^Nome/).fill("Tappa 4 · Lignano");
  await page.getByLabel(/^Luogo/).fill("Lignano, Bagno 3");
  await page.getByLabel(/^Data/).fill("2020-01-10");
  await page.getByLabel(/^Scadenza/).fill("2099-06-20T10:00");
  await page.getByRole("button", { name: "Crea tappa in bozza" }).click();
  await expect(page.getByLabel(/^Data/)).toHaveAccessibleDescription(
    /La data della tappa deve essere futura/,
  );
  await expect(page.getByLabel(/^Data/)).toBeFocused();

  await page.getByLabel(/^Data/).fill("2099-06-14");
  await page.getByRole("button", { name: "Crea tappa in bozza" }).click();
  await expect(page.getByLabel(/^Scadenza/)).toHaveAccessibleDescription(
    /La scadenza deve precedere la data della tappa/,
  );
  await expect(page.getByLabel(/^Scadenza/)).toBeFocused();
  // What was typed survives the refused submit.
  await expect(page.getByLabel(/^Nome/)).toHaveValue("Tappa 4 · Lignano");

  await page.getByLabel(/^Scadenza/).fill("2099-06-07T23:59");
  await page.getByRole("button", { name: "Crea tappa in bozza" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Salvataggio non disponibile" }),
  ).toBeVisible();
});

test("avviso gironi: annunciato una volta, «Usa 32» lo risolve", async ({
  page,
}) => {
  const campo = page.getByRole("spinbutton", { name: /tabellone maschile/ });
  const avviso = page.getByRole("status").filter({
    hasText: "Tabellone maschile: con 20 iscritti",
  });

  // Record what the status region says while the warning shows up.
  await page.evaluate(() => {
    const w = window as unknown as { annunci: string[] };
    w.annunci = [];
    let ultimo = "";
    // Every change of the region's text is a new announcement.
    new MutationObserver(() => {
      const el = document.querySelector(
        "form [data-slot=avviso-gironi] [role=status]",
      );
      const text = el?.textContent?.trim() ?? "";
      if (text !== ultimo) {
        ultimo = text;
        if (text) w.annunci.push(text);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

  await campo.fill("20");
  await expect(avviso).toHaveCount(0);
  await campo.press("Tab");

  await expect(avviso).toHaveCount(1);
  await expect(avviso).toContainText(
    "i gironi da 4 non sono completi in tutte le fasi",
  );
  await expect(campo).toHaveAccessibleDescription(/non sono completi/);
  await expect(page.getByText(/non sono completi/)).toHaveCount(1);
  await expectNoA11yViolations(page);

  // Blurring again with the same value does not announce it twice.
  await campo.focus();
  await campo.press("Tab");
  const annunci = await page.evaluate(
    () => (window as unknown as { annunci: string[] }).annunci,
  );
  expect(annunci).toHaveLength(1);
  expect(annunci[0]).toContain("con 20 iscritti");

  await page.getByRole("button", { name: "Usa 32" }).click();
  await expect(campo).toHaveValue("32");
  await expect(campo).toBeFocused();
  await expect(page.getByText(/non sono completi/)).toHaveCount(0);
});

test("nessuno scroll orizzontale con testo al 200%, avviso compreso", async ({
  page,
}) => {
  const campo = page.getByRole("spinbutton", { name: /tabellone femminile/ });
  await campo.fill("12");
  await campo.press("Tab");
  await expect(page.getByText(/non sono completi/)).toBeVisible();
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const width of [1440, 1024, 768, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scroll orizzontale a ${width}px`).toBeLessThanOrEqual(
      clientWidth,
    );
  }
  await expectNoA11yViolations(page);
});
