import { expect, expectNoA11yViolations, test } from "./fixtures";
import { PUNTI_PER_POSIZIONE } from "../src/lib/tappe/classifica/punti";

/*
 * w-regole (BLVS-46): public, static, every text from the configuration.
 * Runs signed out on every viewport project.
 */

const WIDTHS = [1440, 1024, 768, 390];

test("si apre senza accesso, con i tre passi e le regole da confermare", async ({
  page,
}) => {
  await page.goto("/regole");
  await expect(page).toHaveURL(/\/regole$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Regole e punteggi" }),
  ).toBeVisible();

  const formato = page.getByRole("region", { name: /Il formato della tappa/ });
  await expect(formato.getByRole("listitem")).toHaveCount(3);

  // Q-01, Q-03, Q-04, Q-06: one label per open section, plus the legend.
  for (const nome of [
    /Il formato della tappa/,
    /^Il set/,
    /Classifica del girone/,
    /Classifica generale/,
  ]) {
    await expect(
      page.getByRole("region", { name: nome }).getByText("da confermare"),
    ).toBeVisible();
  }
  await expect(
    page
      .getByRole("region", { name: /Punti di tappa/ })
      .getByText("da confermare"),
  ).toHaveCount(0);

  await expectNoA11yViolations(page);
});

test("la tabella dei punti è quella della configurazione", async ({ page }) => {
  await page.goto("/regole");
  const punti = page.getByRole("region", { name: /Punti di tappa/ });
  const testo = await punti.innerText();
  for (const fase of ["gold", "silver"] as const) {
    for (const valore of PUNTI_PER_POSIZIONE[fase]) {
      expect(testo).toContain(String(valore));
    }
  }
  await expect(
    punti.getByText(
      `chi vince la finale Gold prende ${PUNTI_PER_POSIZIONE.gold[0]} punti`,
      { exact: false },
    ),
  ).toBeVisible();
});

test("dalla classifica si arriva alle regole", async ({ page }) => {
  await page.goto("/classifica");
  await page.getByText("Come si calcola la classifica").click();
  await page
    .getByRole("link", { name: "Tutte le regole e i punti di tappa" })
    .click();
  await expect(page).toHaveURL(/\/regole#classifica-generale$/);
});

test("sessione scaduta: avviso sopra le regole", async ({ page }) => {
  await page.goto("/regole?motivo=scaduta");
  await expect(
    page.getByRole("heading", { name: "Sessione scaduta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: /Punti di tappa/ }),
  ).toBeVisible();
  await expectNoA11yViolations(page);
});

test("testo al 200%: nessuno scroll orizzontale da 1440 a 390 px", async ({
  page,
}) => {
  await page.goto("/regole");
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scroll orizzontale a ${width}px`).toBeLessThanOrEqual(
      clientWidth,
    );
    await expect(page.getByText("da confermare").first()).toBeVisible();
  }
  await expectNoA11yViolations(page);
});
