import { expect, expectNoA11yViolations, test } from "./fixtures";
import { allega, misura, tastieraEZoom, testo200 } from "./a11y/misure";
import { SCHERMATE } from "./a11y/schermate";
import { waitForAnimations } from "./storybook-helpers";

/**
 * BLVS-56 · WCAG 2.2 AA final check, app side: every screen reachable on
 * the demo data, in both projects (mobile-390 and desktop-1440). The
 * screens shown through Storybook run in storybook-schermate.spec.ts.
 * Each run attaches its measurements; `npm run a11y:report` turns them
 * into the tables of docs/a11y-report.md.
 */

test.describe("inventario", () => {
  test("56 schermate, id unici, ognuna raggiungibile o in attesa", async ({}, testInfo) => {
    // The inventory for `npm run a11y:report` (one per project is enough).
    await testInfo.attach("inventario", {
      contentType: "application/json",
      body: JSON.stringify(
        SCHERMATE.map(
          ({ id, titolo, area, bordoCampo, storie, inAttesa, disattiva }) => ({
            id,
            titolo,
            area,
            bordoCampo: Boolean(bordoCampo),
            storie: storie ?? [],
            app: Boolean(SCHERMATE.find((s) => s.id === id)?.app),
            inAttesa: inAttesa ?? null,
            disattiva: disattiva ?? [],
          }),
        ),
      ),
    });
    expect(SCHERMATE).toHaveLength(56);
    const ids = SCHERMATE.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCHERMATE) {
      expect(
        Boolean(s.app || s.storie?.length || s.inAttesa),
        `${s.id}: né percorso, né storia, né dipendenza in attesa`,
      ).toBe(true);
    }
  });

  test("ogni regola axe disattivata ha un motivo", () => {
    for (const s of SCHERMATE) {
      for (const r of s.disattiva ?? []) {
        expect(r.motivo.trim().length, `${s.id} · ${r.regola}`).toBeGreaterThan(
          20,
        );
      }
    }
  });
});

for (const schermata of SCHERMATE.filter((s) => s.app)) {
  test(`${schermata.id} · ${schermata.titolo}`, async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.setTimeout(60_000);
    const viewport = page.viewportSize()!;
    const path = await schermata.app!({
      page,
      context,
      // The page's own request context: demo fixtures set cookies on it.
      request: page.request,
      baseURL: baseURL!,
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await schermata.apri?.(page);
    await waitForAnimations(page);

    await expectNoA11yViolations(page, (b) =>
      b.disableRules((schermata.disattiva ?? []).map((r) => r.regola)),
    );

    const m = await misura(
      page,
      schermata,
      {
        pagina: "body",
        campo: "#contenuto, [data-base-ui-portal]",
      },
      { name: String(viewport.width), width: viewport.width },
      `app ${path}`,
    );
    if (viewport.width >= 1440) Object.assign(m, await tastieraEZoom(page));
    else Object.assign(m, await testo200(page));
    await allega(testInfo, m);

    expect(m.scrollOrizzontale, "scroll orizzontale della pagina").toBe(false);
    expect(
      m.targetSottoSoglia,
      `Controlli sotto ${m.sogliaTarget}×${m.sogliaTarget} px`,
    ).toEqual([]);
    expect(
      m.contrastoSottoSoglia,
      "Punteggi, posizioni e Live sotto 7:1",
    ).toEqual([]);
    expect(
      m.testo200?.scrollOrizzontale ?? false,
      "scroll orizzontale a 390 px con testo al 200%",
    ).toBe(false);
    if (m.tastiera) {
      expect(
        m.tastiera.fermate,
        "nessun elemento raggiungibile con Tab",
      ).toBeGreaterThan(0);
      expect(
        m.tastiera.senzaIndicatore,
        "focus senza indicatore visibile",
      ).toEqual([]);
      expect(m.tastiera.oscurati, "focus nascosto da altri elementi").toEqual(
        [],
      );
      expect(
        m.zoom200?.scrollOrizzontale,
        "scroll orizzontale a zoom 200%",
      ).toBe(false);
      expect(
        m.zoom400?.scrollOrizzontale,
        "scroll orizzontale a zoom 400% (320 px)",
      ).toBe(false);
    }
  });
}
