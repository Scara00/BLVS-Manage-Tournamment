import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/**
 * BLVS-33 in the demo (no Supabase): /admin/anteprima/punteggio is a
 * dev/e2e-only score form that saves through the device queue
 * (IndexedDB). Each test creates its own demo match with
 * POST /api/demo/punteggi and reads back how many times it was written.
 * The cookie `blvs_demo_sessione_chiusa=1` makes the server answer
 * «sessione chiusa», as the proxy does after the admin idle timeout.
 */
const PATH = "/admin/anteprima/punteggio";
const ETICHETTA = "Partita di prova";

type DemoPartita = {
  sets: { a: number; b: number }[];
  versione: number;
  scritture: number;
};

async function nuovaPartita(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/demo/punteggi", { data: {} });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { partitaId: string }).partitaId;
}

async function partita(
  request: APIRequestContext,
  id: string,
): Promise<DemoPartita> {
  const res = await request.get(`/api/demo/punteggi?partita=${id}`);
  expect(res.ok()).toBe(true);
  return (await res.json()) as DemoPartita;
}

/** Records every text of the queue's status region. */
async function registraAnnunci(page: Page) {
  await page.evaluate(() => {
    const region = document.querySelector(
      "[data-slot=coda-punteggi-annuncio]",
    )!;
    const seen: string[] = [];
    (window as unknown as { __annunci: string[] }).__annunci = seen;
    new MutationObserver(() => {
      if (region.textContent) seen.push(region.textContent);
    }).observe(region, { childList: true, subtree: true, characterData: true });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __annunci: string[] }).__annunci,
    );
}

async function apri(page: Page, id: string) {
  await page.goto(`${PATH}?partita=${id}&versione=1`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Anteprima punteggio" }),
  ).toBeVisible();
}

async function salva(page: Page, a: number, b: number) {
  await page.getByLabel("Punti squadra A").fill(String(a));
  await page.getByLabel("Punti squadra B").fill(String(b));
  await page.getByRole("button", { name: "Salva punteggio" }).click();
}

const voce = (page: Page, id: string) =>
  page.locator(`li[data-partita="${id}"]`);

test.describe("coda dei punteggi offline", () => {
  test("senza rete il punteggio resta «in attesa di invio» e parte una volta sola al ritorno della rete", async ({
    page,
    context,
    request,
  }) => {
    const id = await nuovaPartita(request);
    await apri(page, id);
    const annunci = await registraAnnunci(page);

    await context.setOffline(true);
    await salva(page, 21, 18);

    await expect(voce(page, id)).toHaveAttribute("data-stato", "in_attesa");
    await expect(
      page.locator("form").getByText("In attesa di invio"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Punteggi su questo dispositivo" }),
    ).toContainText("1 punteggio in attesa di invio");
    await expect
      .poll(annunci)
      .toContainEqual(
        expect.stringContaining(`${ETICHETTA}: in attesa di invio.`),
      );
    expect((await partita(request, id)).scritture).toBe(0);
    await expectNoA11yViolations(page);

    await context.setOffline(false);
    await expect(voce(page, id)).toHaveAttribute("data-stato", "salvato");
    await expect(
      page.locator("form").getByText("Salvato", { exact: true }),
    ).toBeVisible();
    await expect.poll(annunci).toContain(`${ETICHETTA}: salvato.`);

    // A reload sends nothing again: the key was saved once.
    await page.reload();
    await expect(voce(page, id)).toHaveAttribute("data-stato", "salvato");
    expect(await partita(request, id)).toMatchObject({
      scritture: 1,
      versione: 2,
      sets: [{ a: 21, b: 18 }],
    });
    await expectNoA11yViolations(page);
  });

  test("a sessione chiusa il dato resta («Salvato qui, non ancora inviato») e parte dopo il nuovo accesso", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    const id = await nuovaPartita(request);
    await context.addCookies([
      { name: "blvs_demo_sessione_chiusa", value: "1", url: baseURL! },
    ]);
    await apri(page, id);
    const annunci = await registraAnnunci(page);

    await salva(page, 21, 15);
    await expect(voce(page, id)).toHaveAttribute(
      "data-stato",
      "sessione_chiusa",
    );
    await expect(
      page.locator("form").getByText("Salvato qui, non ancora inviato"),
    ).toBeVisible();
    await expect
      .poll(annunci)
      .toContainEqual(
        expect.stringContaining(
          `${ETICHETTA}: salvato qui, non ancora inviato.`,
        ),
      );
    await expectNoA11yViolations(page);

    // w-admin-sessione lists it among what is kept on the device.
    await page.goto(`/sessione-scaduta?da=${encodeURIComponent(PATH)}`);
    const sezione = page.getByRole("region", {
      name: "Punteggi salvati qui, non ancora inviati",
    });
    await expect(
      sezione.getByRole("list", { name: "Punteggi non ancora inviati" }),
    ).toContainText(ETICHETTA);
    await expect(sezione).toContainText("Salvato qui, non ancora inviato");
    await expectNoA11yViolations(page);
    expect((await partita(request, id)).scritture).toBe(0);

    // Signed in again: back on an admin page, the queue leaves on its own.
    await context.clearCookies({ name: "blvs_demo_sessione_chiusa" });
    await apri(page, id);
    await expect(voce(page, id)).toHaveAttribute("data-stato", "salvato");
    expect(await partita(request, id)).toMatchObject({
      scritture: 1,
      sets: [{ a: 21, b: 15 }],
    });
  });

  test("se un altro admin ha salvato prima, resta da verificare e l'admin sceglie", async ({
    page,
    request,
  }) => {
    const id = await nuovaPartita(request);
    await request.post("/api/demo/punteggi", {
      data: { partitaId: id, sets: [{ a: 21, b: 10 }] },
    });
    await apri(page, id);

    await salva(page, 21, 19);
    await expect(voce(page, id)).toHaveAttribute("data-stato", "conflitto");
    await expect(voce(page, id)).toContainText("Un altro admin ha salvato");
    await expectNoA11yViolations(page);

    await voce(page, id)
      .getByRole("button", { name: /Tieni il mio/ })
      .click();
    await expect(voce(page, id)).toHaveAttribute("data-stato", "salvato");
    expect(await partita(request, id)).toMatchObject({
      versione: 3,
      sets: [{ a: 21, b: 19 }],
    });
  });
});
