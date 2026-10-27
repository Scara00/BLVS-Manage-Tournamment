import type { Locator, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

async function openStory(page: Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await page.locator("#storybook-root > *").first().waitFor();
}

/** ids referenced by aria-describedby, resolved to their text. */
async function description(locator: Locator) {
  return locator.evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" "),
  );
}

async function expectFocusRing(locator: Locator) {
  const width = await locator.evaluate((el) =>
    parseFloat(getComputedStyle(el).outlineWidth),
  );
  expect(width).toBeGreaterThan(0);
}

async function expectMinSize(locator: Locator, min: number) {
  for (const box of await locator.all()) {
    const rect = await box.boundingBox();
    expect(rect, "elemento non visibile").not.toBeNull();
    expect(rect!.width).toBeGreaterThanOrEqual(min);
    expect(rect!.height).toBeGreaterThanOrEqual(min);
  }
}

test.describe("Modulo di esempio, solo tastiera", () => {
  test.beforeEach(async ({ page }) => {
    await openStory(page, "ui-modulo-di-esempio--default");
  });

  test("ordine di tabulazione e anello di focus", async ({ page }) => {
    const order = [
      page.getByRole("textbox", { name: /Nome squadra/ }),
      page.getByRole("textbox", { name: "Email del capitano" }),
      page.getByRole("combobox", { name: /Categoria/ }),
      page.getByRole("radio", { name: "2 contro 2" }),
      page.getByRole("checkbox", { name: "Accetto il regolamento del torneo" }),
      page.getByRole("button", { name: "Iscrivi squadra" }),
      page.getByRole("button", { name: "Paga la quota" }),
    ];
    for (const control of order) {
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
      await expectFocusRing(control);
    }

    // The disabled button is reachable and announces why it is disabled.
    const paga = order.at(-1)!;
    await expect(paga).toHaveAttribute("aria-disabled", "true");
    expect(await description(paga)).toBe(
      "Disponibile dopo la conferma dell'iscrizione",
    );
  });

  test("invio vuoto mostra errori collegati, poi compilazione e invio", async ({
    page,
  }) => {
    const nome = page.getByRole("textbox", { name: /Nome squadra/ });
    const categoria = page.getByRole("combobox", { name: /Categoria/ });
    const formula = page.getByRole("radiogroup", { name: /Formula/ });
    const regolamento = page.getByRole("checkbox", {
      name: "Accetto il regolamento del torneo",
    });

    await page.keyboard.press("Tab");
    await expect(nome).toBeFocused();
    await page.keyboard.press("Enter");

    for (const [control, message] of [
      [nome, "Inserisci il nome della squadra"],
      [categoria, "Scegli una categoria"],
      [formula, "Scegli una formula"],
      [regolamento, "Devi accettare il regolamento"],
    ] as const) {
      await expect(control).toHaveAttribute("aria-invalid", "true");
      expect(await description(control)).toContain(message);
    }
    await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));

    await page.keyboard.type("Sabbia Mobile");
    await page.keyboard.press("Tab"); // email
    await page.keyboard.press("Tab"); // categoria
    await expect(categoria).toBeFocused();
    // Type-ahead picks an option on every platform without opening the
    // native picker (ArrowDown opens it on macOS).
    await page.keyboard.press("F");
    await expect(categoria).toHaveValue("f");

    await page.keyboard.press("Tab");
    const dueControDue = page.getByRole("radio", { name: "2 contro 2" });
    const quattro = page.getByRole("radio", { name: "4 contro 4" });
    await expect(dueControDue).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(quattro).toBeFocused();
    await expect(quattro).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Tab");
    await expect(regolamento).toBeFocused();
    await page.keyboard.press("Space");
    await expect(regolamento).toHaveAttribute("aria-checked", "true");

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Iscrivi squadra" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("status")).toHaveText("Iscrizione inviata.");
    await expect(nome).not.toHaveAttribute("aria-invalid");
    await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));
  });

  test("bersagli di tocco di almeno 24×24 px", async ({ page }) => {
    await expectMinSize(page.getByRole("textbox"), 24);
    await expectMinSize(page.getByRole("combobox"), 24);
    await expectMinSize(page.getByRole("button"), 24);
    await expectMinSize(page.locator("[data-slot=radio-card]"), 24);
    await expectMinSize(page.locator("[data-slot=checkbox]"), 24);
    await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));
  });
});

test.describe("Bordo campo: bersagli di almeno 48×48 px", () => {
  const stories: [string, (page: Page) => Locator][] = [
    ["ui-button--bordo-campo", (p) => p.getByRole("button")],
    ["ui-input--bordo-campo", (p) => p.getByRole("textbox")],
    ["ui-select--bordo-campo", (p) => p.getByRole("combobox")],
    ["ui-checkbox--bordo-campo", (p) => p.locator("[data-slot=checkbox]")],
    ["ui-radiocard--bordo-campo", (p) => p.locator("[data-slot=radio-card]")],
  ];

  for (const [id, target] of stories) {
    test(id, async ({ page }) => {
      await openStory(page, id);
      await expectMinSize(target(page), 48);
      await expectNoA11yViolations(page, (b) => b.include("#storybook-root"));
    });
  }
});
