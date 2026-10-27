import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * w-admin-live and w-admin-punteggio on the in-memory demo scores (no
 * Supabase in e2e). Each test creates its own stage in progress through
 * the demo-only POST /api/demo/inserimento-punteggio, because the server is
 * shared by parallel projects and reused across runs.
 */
async function creaTappa(request: APIRequestContext) {
  const response = await request.post("/api/demo/inserimento-punteggio");
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function apriPrimaPartita(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("elenco-punteggi")).toBeVisible();
  await expect(page.getByTestId("conta-da-inserire")).toHaveText(
    "6 partite da inserire",
  );
  await page
    .getByRole("link", { name: /^Inserisci il punteggio:/ })
    .first()
    .click();
  await expect(page.getByTestId("inserimento-punteggio")).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

const campo = (page: Page, n: 0 | 1) =>
  page.getByRole("textbox").filter({ visible: true }).nth(n);

test("elenco della tappa: accessibile, link per ogni partita", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("elenco-punteggi")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^Inserisci il punteggio:/ }),
  ).toHaveCount(6);
  await expectNoA11yViolations(page);
});

test("campi numerici, pulsanti da 56 px e aree ≥ 48 px", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await apriPrimaPartita(page, id);

  await expect(campo(page, 0)).toHaveAttribute("inputmode", "numeric");
  const piu = page.getByRole("button", { name: /^Aggiungi un punto a / });
  const meno = page.getByRole("button", { name: /^Togli un punto a / });
  await expect(piu).toHaveCount(2);
  await expect(meno).toHaveCount(2);
  for (const bottone of [...(await piu.all()), ...(await meno.all())]) {
    const box = (await bottone.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(56);
    expect(box.height).toBeGreaterThanOrEqual(56);
  }
  for (const n of [0, 1] as const) {
    expect((await campo(page, n).boundingBox())!.height).toBeGreaterThanOrEqual(
      48,
    );
  }
  const avanti = page.getByRole("button", { name: "Vai al riepilogo" });
  expect((await avanti.boundingBox())!.height).toBeGreaterThanOrEqual(48);

  await piu.first().click();
  await piu.first().click();
  await expect(campo(page, 0)).toHaveValue("2");
  await expectNoA11yViolations(page);
});

test("errori annunciati: pareggio e regola del set", async ({
  page,
  request,
}) => {
  const id = await creaTappa(request);
  await apriPrimaPartita(page, id);

  await page.evaluate(() => {
    const w = window as unknown as { annunci: string[] };
    w.annunci = [];
    const regione = document.querySelector("[data-testid=annuncio-punteggio]")!;
    new MutationObserver(() => {
      if (regione.textContent) w.annunci.push(regione.textContent);
    }).observe(regione, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });

  await campo(page, 0).fill("21");
  await campo(page, 1).fill("21");
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await expect(page.getByTestId("errore-set")).toContainText(
    "Il pareggio non è ammesso",
  );
  await expect(campo(page, 0)).toHaveAttribute("aria-invalid", "true");
  await expect(campo(page, 0)).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { annunci: string[] }).annunci),
    )
    .toContainEqual(expect.stringContaining("Il pareggio non è ammesso"));
  await expectNoA11yViolations(page);

  await campo(page, 1).fill("20");
  await expect(page.getByTestId("errore-set")).toContainText(
    "servono almeno 2 punti di scarto",
  );
  await expect(page.getByText("!da correggere")).toHaveCount(2);
  await campo(page, 1).fill("1.5");
  await expect(page.getByText(/numero intero/)).toBeVisible();
  await expect(page.getByTestId("riepilogo-punteggio")).toHaveCount(0);
});

test("da tastiera: riepilogo, Conferma e salva, Annulla entro 10 s, live", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await apriPrimaPartita(page, id);
  const partitaId = page.url().split("/").pop()!;

  await campo(page, 0).focus();
  await page.keyboard.type("19");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(campo(page, 1)).toBeFocused();
  await page.keyboard.type("21");
  await expect(page.getByText("✓valido")).toHaveCount(2);
  await page.keyboard.press("Enter");

  const riepilogo = page.getByTestId("riepilogo-punteggio");
  await expect(riepilogo).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Riepilogo prima del salvataggio" }),
  ).toBeFocused();
  await expect(riepilogo.locator("[data-vincitore]")).toContainText("Vince");
  await expectNoA11yViolations(page);

  await page.getByRole("button", { name: "Conferma e salva" }).click();
  await expect(page.getByTestId("esito-punteggio")).toContainText(
    "Punteggio salvato",
  );
  await expect(page.getByTestId("esito-punteggio")).toBeFocused();

  // Live within 5 s: the snapshot carries the saved set.
  await expect
    .poll(
      async () => {
        const sync = (await (
          await request.get("/api/live/snapshot")
        ).json()) as {
          snapshot: { matches: { id: string; sets: number[][] }[] };
        };
        return sync.snapshot.matches.find((m) => m.id === partitaId)?.sets;
      },
      { timeout: 5_000 },
    )
    .toEqual([[19, 21]]);

  const toast = page.locator("[data-slot=toast]");
  const annulla = toast.getByRole("button", {
    name: /^Annulla il salvataggio/,
  });
  await expect(annulla).toBeVisible();
  expect((await annulla.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await waitForAnimations(page);
  await expect(page).toHaveTitle(/Inserimento punteggio/);
  await expectNoA11yViolations(page);

  // Hovering the toast pauses its timer: still there well past 10 s. Real
  // time on purpose: page.clock would also freeze the toast's animations.
  await annulla.hover();
  await page.waitForTimeout(12_000);
  await expect(annulla).toBeVisible();
  await annulla.click();

  await expect(page.getByTestId("esito-punteggio")).toContainText(
    "Salvataggio annullato",
  );
  await expect(campo(page, 0)).toHaveValue("");
  await expect
    .poll(async () => {
      const sync = (await (await request.get("/api/live/snapshot")).json()) as {
        snapshot: { matches: { id: string; sets: number[][] }[] };
      };
      return sync.snapshot.matches.find((m) => m.id === partitaId)?.sets;
    })
    .toEqual([]);

  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("conta-da-inserire")).toHaveText(
    "6 partite da inserire",
  );
});

test("il toast si chiude da solo dopo 10 s senza interazione", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  const id = await creaTappa(request);
  await apriPrimaPartita(page, id);
  await campo(page, 0).fill("23");
  await campo(page, 1).fill("21");
  await page.getByRole("button", { name: "Vai al riepilogo" }).click();
  await page.getByRole("button", { name: "Conferma e salva" }).click();
  const annulla = page.getByRole("button", {
    name: /^Annulla il salvataggio/,
  });
  await expect(annulla).toBeVisible();
  // Focus is on the confirmation message and the pointer away from the
  // toast: «Annulla» stays for 10 s, then the toast closes.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(8_000);
  await expect(annulla).toBeVisible();
  await expect(annulla).toHaveCount(0, { timeout: 6_000 });

  await page.goto(`/admin/tappe/${id}/punteggi`);
  await expect(page.getByTestId("conta-da-inserire")).toHaveText(
    "5 partite da inserire",
  );
  await expect(page.getByText("23–21")).toBeVisible();
});
