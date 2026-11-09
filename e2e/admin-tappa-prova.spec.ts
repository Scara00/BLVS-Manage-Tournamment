import type { APIRequestContext, Page } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";
import { waitForAnimations } from "./storybook-helpers";

/**
 * «Tappa di prova» on the in-memory demo stages (no Supabase in e2e): a
 * draft played end to end. The demo has no roles, so the player pages
 * open for anyone here; with Supabase only admins see them (unit tests).
 * The stage is created by the demo-only POST /api/demo/tappe, because the
 * server is shared by parallel projects and reused across runs.
 */
const DAY = 24 * 60 * 60 * 1000;

async function creaBozza(request: APIRequestContext) {
  const response = await request.post("/api/demo/tappe", {
    data: {
      stato: "bozza",
      chiudonoIl: new Date(Date.now() + 10 * DAY).toISOString(),
      nome: "Tappa di prova e2e",
    },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function apriGestione(page: Page, id: string) {
  await page.goto(`/admin/tappe/${id}`);
  await expect(page.getByTestId("gestione-tappa")).toBeVisible();
  // Client buttons hydrate after the streamed content.
  await page.waitForLoadState("networkidle");
}

// The demo detail page reads only the fixed demo calendar, not the stages
// made by /api/demo/tappe, so it is left out here.
const PAGINE = ["/live", "/tabellone", "/classifica"];

test("tappa di prova: accesa apre le pagine giocatore con l'avviso, spenta la bozza torna 404", async ({
  page,
  request,
}) => {
  const id = await creaBozza(request);
  expect((await page.goto(`/tappe/${id}/tabellone`))?.status()).toBe(404);

  await apriGestione(page, id);
  const sezione = page.getByRole("region", { name: "Tappa di prova" });
  await expect(sezione.getByTestId("tappa-di-prova-stato")).toHaveText(
    "Spenta.",
  );
  await sezione
    .getByRole("button", { name: "Attiva la tappa di prova" })
    .click();
  await expect(sezione.getByTestId("tappa-di-prova-stato")).toHaveText(
    "Attiva.",
  );
  await expect(
    sezione.getByRole("navigation", {
      name: "Pagine giocatore della tappa di prova",
    }),
  ).toBeVisible();
  // The button turns secondary with a colour transition: measure after it.
  await waitForAnimations(page);
  await expectNoA11yViolations(page);

  for (const pagina of PAGINE) {
    const risposta = await page.goto(`/tappe/${id}${pagina}`);
    expect(risposta?.status(), `/tappe/${id}${pagina}`).toBe(200);
    await expect(page.getByTestId("avviso-tappa-prova")).toBeVisible();
  }
  await expectNoA11yViolations(page);

  await apriGestione(page, id);
  await page
    .getByRole("region", { name: "Tappa di prova" })
    .getByRole("button", { name: "Spegni la tappa di prova" })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Tappa di prova" })
      .getByTestId("tappa-di-prova-stato"),
  ).toHaveText("Spenta.");
  expect((await page.goto(`/tappe/${id}/live`))?.status()).toBe(404);
});
