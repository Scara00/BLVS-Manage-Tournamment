import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { expect, expectNoA11yViolations, test } from "./fixtures";

/*
 * The live channel end to end. Results are "saved" through the demo-only
 * POST /api/live/publish (LIVE_DEMO_PUBLISH=true in playwright.config.ts).
 * Each test publishes its own match id, so parallel projects sharing the
 * server's bus never see each other's assertions.
 *
 * Never wait for "networkidle" here: the SSE stream keeps a request open.
 */

// By role: the streamed (still hidden) content and the Suspense fallback
// briefly coexist; only one of them is ever exposed to assistive tech.
const liveBar = (page: Page) =>
  page.getByRole("region", { name: "Stato degli aggiornamenti" });

async function waitForLive(page: Page) {
  await expect(liveBar(page)).toHaveAttribute("data-status", "live", {
    timeout: 10_000,
  });
}

/** Fresh per run: the server (and its bus) can outlive a test run. */
function uniqueMatchId(testInfo: TestInfo) {
  return `e2e-${testInfo.project.name}-${crypto.randomUUID()}`;
}

async function publishScore(
  request: APIRequestContext,
  id: string,
  sets: [number, number][],
  groupId = "a",
) {
  const res = await request.post("/api/live/publish", {
    data: {
      type: "score",
      match: {
        id,
        court: "Campo 9",
        groupId,
        groupLabel: groupId === "a" ? "Girone A" : "Girone B",
        home: "Prova / Uno",
        away: "Prova / Due",
        sets,
      },
    },
  });
  expect(res.status()).toBe(201);
}

const setsText = (sets: [number, number][]) =>
  sets.map(([h, a]) => `${h}–${a}`).join(" · ");

/**
 * Records every text the LiveAnnouncer region takes. Parallel tests publish
 * on the same server, so the region may move on before an assertion runs.
 */
async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const region = document.querySelector("[data-slot=live-announcer]")!;
    const seen: string[] = [];
    (window as unknown as { __announced: string[] }).__announced = seen;
    new MutationObserver(() => {
      if (region.textContent) seen.push(region.textContent);
    }).observe(region, { childList: true, subtree: true, characterData: true });
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __announced: string[] }).__announced,
    );
}

/** The card of one match on /live (cards carry their match id). */
const matchCard = (page: Page, id: string) =>
  page.locator(`li[data-live-key="${id}"]`);

test("/live: stato live accessibile con «Live» e orario", async ({ page }) => {
  await page.goto("/live");
  await waitForLive(page);
  await expect(liveBar(page)).toContainText("Live");
  await expect(liveBar(page)).toContainText(
    /Ultimo aggiornamento alle \d\d:\d\d/,
  );
  await expectNoA11yViolations(page);
});

test("un risultato salvato arriva al client entro 5 s", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/live");
  await waitForLive(page);
  const announced = await recordAnnouncements(page);

  const id = uniqueMatchId(testInfo);
  const sets: [number, number][] = [
    [21, 19],
    [15, 13],
  ];
  const started = Date.now();
  await publishScore(request, id, sets);
  await expect(matchCard(page, id).getByText(setsText(sets))).toBeVisible({
    timeout: 5_000,
  });
  expect(Date.now() - started).toBeLessThan(5_000);

  await expect
    .poll(announced)
    .toContainEqual(expect.stringContaining("Girone A: nuovo risultato 15-13"));
});

test("un aggiornamento non sposta il focus", async ({
  page,
  request,
}, testInfo) => {
  await page.goto("/live");
  await waitForLive(page);

  const link = page.getByRole("link", { name: "Classifica" }).first();
  await link.focus();
  const id = uniqueMatchId(testInfo);
  const sets: [number, number][] = [[18, 16]];
  await publishScore(request, id, sets);
  await expect(matchCard(page, id).getByText(setsText(sets))).toBeVisible();
  await expect(link).toBeFocused();
});

test("rete caduta: dati non aggiornati, poi riallineamento completo", async ({
  page,
  context,
  request,
}, testInfo) => {
  await page.goto("/live");
  await waitForLive(page);

  await context.setOffline(true);
  await expect(liveBar(page)).toHaveAttribute("data-status", "offline");
  await expect(liveBar(page)).toContainText(
    /Dati non aggiornati dalle \d\d:\d\d/,
  );
  await expectNoA11yViolations(page);

  // Saved while this client is offline: must show up after the resync.
  const id = uniqueMatchId(testInfo);
  const sets: [number, number][] = [[9, 7]];
  await publishScore(request, id, sets);
  await expect(matchCard(page, id).getByText(setsText(sets))).toHaveCount(0);

  await context.setOffline(false);
  await waitForLive(page);
  await expect(matchCard(page, id).getByText(setsText(sets))).toBeVisible();
});

test("con riduzione del movimento il riordino non anima nulla", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/gironi/b");
  await waitForLive(page);
  const announced = await recordAnnouncements(page);

  const res = await request.post("/api/live/publish", {
    data: {
      type: "group-standings",
      group: {
        id: "b",
        label: "Girone B",
        rows: [
          {
            position: 1,
            pair: "Colombo / Ricci",
            played: 3,
            won: 2,
            points: 6,
          },
          {
            position: 2,
            pair: "Esposito / Romano",
            played: 3,
            won: 2,
            points: 6,
          },
          {
            position: 3,
            pair: "Fontana / Moretti",
            played: 2,
            won: 0,
            points: 0,
          },
        ],
      },
    },
  });
  expect(res.status()).toBe(201);
  await expect
    .poll(announced)
    .toContainEqual(expect.stringContaining("Classifica Girone B aggiornata"));
  const running = await page
    .locator("#contenuto")
    .evaluate((root) => root.getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});

test("/gironi/a: classifica del girone accessibile", async ({ page }) => {
  await page.goto("/gironi/a");
  await expect(
    page.getByRole("heading", { level: 1, name: "Girone A" }),
  ).toBeVisible();
  await waitForLive(page);
  await expect(page).toHaveTitle("Girone A · BLVS");
  await expectNoA11yViolations(page);
});

test("/classifica: classifica generale accessibile", async ({ page }) => {
  await page.goto("/classifica");
  await waitForLive(page);
  await expectNoA11yViolations(page);
});

test("un girone inesistente risponde 404", async ({ page }) => {
  const res = await page.goto("/gironi/zz");
  expect(res?.status()).toBe(404);
});

test("l'endpoint snapshot restituisce lo stato corrente", async ({
  request,
}) => {
  const res = await request.get("/api/live/snapshot");
  expect(res.headers()["cache-control"]).toContain("no-store");
  const body = await res.json();
  expect(body.snapshot.groups.map((g: { id: string }) => g.id)).toEqual(
    expect.arrayContaining(["a", "b"]),
  );
});
