import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";
import { SELETTORE_TABELLONE, type Schermata } from "./schermate";

/** WCAG 2.5.8 minimum, and the project's courtside minimum (R-66). */
export const MIN_TARGET = 24;
export const MIN_TARGET_BORDO_CAMPO = 48;
/** Scores, positions and Live: AAA (R-67), as in src/lib/design-tokens. */
export const MIN_CONTRASTO_TABELLONE = 7;

export type Target = {
  selettore: string;
  nome: string;
  larghezza: number;
  altezza: number;
  /** Under 24 px but meets the 2.5.8 spacing exception. */
  spaziato: boolean;
};

export type Misura = {
  schermata: string;
  vista: string;
  larghezza: number;
  sorgente: string;
  /** The smallest control of the content (by its shorter side). */
  targetMinimo: Target | null;
  /** Controls under the minimum (inline links in text are exempt). */
  targetSottoSoglia: Target[];
  sogliaTarget: number;
  /** Lowest contrast measured on score/standing/Live text; null = none. */
  contrastoMinimo: number | null;
  contrastoSottoSoglia: { selettore: string; rapporto: number }[];
  scrollOrizzontale: boolean;
  /** Desktop only: Tab tour, 200% zoom (720 px) and 400% zoom (320 px). */
  tastiera?: EsitoTastiera;
  zoom200?: { scrollOrizzontale: boolean };
  zoom400?: { scrollOrizzontale: boolean };
  /** Phone only: text at 200% (user font size), at 390 px. */
  testo200?: { scrollOrizzontale: boolean };
};

/**
 * Every visible control inside `scope`, with its box. Inline links inside
 * a sentence are left out: WCAG 2.5.8 exempts them («inline»). Visually
 * hidden elements (sr-only, 1×1 px) aren't targets.
 */
export async function misuraTarget(page: Page, scope: string) {
  return page.evaluate((scope) => {
    const SEL =
      'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=tab], [role=checkbox], [role=radio], [role=switch], [role=menuitem], [role=option], [tabindex]:not([tabindex="-1"])';
    const roots = [...document.querySelectorAll(scope)];
    const seen = new Set<Element>();
    type Box = { el: Element; r: DOMRect };
    const boxes: Box[] = [];

    // A link inside a sentence: its block has prose besides the links.
    // A paragraph holding only links (a link row) is not inline.
    const inline = (el: Element) => {
      if (el.tagName !== "A") return false;
      // A styled link (button, card action) is a block target, not inline.
      if (getComputedStyle(el).display !== "inline") return false;
      const block = el.closest("p, li, dd, td, figcaption, small");
      if (!block) return false;
      const copy = block.cloneNode(true) as Element;
      copy.querySelectorAll("a, button").forEach((n) => n.remove());
      return /[\p{L}\p{N}]{2,}/u.test(copy.textContent ?? "");
    };
    const describe = (el: Element) => {
      const id = el.id && !el.id.startsWith("base-ui-") ? `#${el.id}` : "";
      const role = el.getAttribute("role");
      const slot = el.getAttribute("data-slot");
      const testid = el.getAttribute("data-testid");
      return (
        el.tagName.toLowerCase() +
        id +
        (role ? `[role=${role}]` : "") +
        (slot ? `[data-slot=${slot}]` : "") +
        (testid ? `[data-testid=${testid}]` : "")
      );
    };
    const nome = (el: Element) => {
      const label = el.closest("label");
      return (
        el.getAttribute("aria-label") ??
        ((el as HTMLElement).innerText ||
          label?.innerText ||
          el.textContent ||
          "")
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);
    };

    for (const root of roots) {
      for (const el of root.querySelectorAll(SEL)) {
        if (seen.has(el)) continue;
        seen.add(el);
        // Not rendered: closed <details>, display:none ancestors…
        if (!el.checkVisibility({ visibilityProperty: true })) continue;
        let r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) continue;
        if (el.closest("[aria-hidden=true], [inert]")) continue;
        // A control inside its <label>: clicking the label activates it,
        // so the label's box is the target (checkbox, radio, switch).
        const label = el.closest("label");
        if (label && !el.matches("a[href], button:not([role])")) {
          const lr = label.getBoundingClientRect();
          if (lr.width >= r.width && lr.height >= r.height) r = lr;
        }
        if (inline(el)) continue;
        boxes.push({ el, r });
      }
    }

    // WCAG 2.5.8 spacing exception: an undersized target passes when a
    // 24 px circle on its centre touches no other target, and no other
    // undersized target's circle.
    const centro = (r: DOMRect) => [r.left + r.width / 2, r.top + r.height / 2];
    const distanza = ([x, y]: number[], r: DOMRect) =>
      Math.hypot(
        Math.max(r.left - x, 0, x - r.right),
        Math.max(r.top - y, 0, y - r.bottom),
      );
    const piccolo = (r: DOMRect) => r.width < 23.5 || r.height < 23.5;
    return boxes.map(({ el, r }) => {
      let spaziato = false;
      if (piccolo(r)) {
        const c = centro(r);
        spaziato = boxes.every(({ el: o, r: or }) => {
          if (o === el || o.contains(el) || el.contains(o)) return true;
          if (distanza(c, or) < 12) return false;
          if (piccolo(or)) {
            const [x, y] = centro(or);
            return Math.hypot(x - c[0], y - c[1]) >= 24;
          }
          return true;
        });
      }
      return {
        selettore: describe(el),
        nome: nome(el),
        larghezza: Math.round(r.width * 10) / 10,
        altezza: Math.round(r.height * 10) / 10,
        spaziato,
      };
    });
  }, scope);
}

/**
 * Contrast of score/standing/Live text as axe measures it
 * (`color-contrast-enhanced`, the AAA rule): the ratio of each checked
 * node, passes and failures alike.
 */
export async function misuraContrastoTabellone(page: Page) {
  if ((await page.locator(SELETTORE_TABELLONE).count()) === 0) return [];
  const result = await new AxeBuilder({ page })
    .include(SELETTORE_TABELLONE)
    .withRules(["color-contrast-enhanced"])
    .analyze();
  const nodes = [...result.passes, ...result.violations].flatMap((r) =>
    r.nodes.map((n) => ({
      selettore: n.target.join(" "),
      rapporto: Number(
        (n.any[0]?.data as { contrastRatio?: number } | null)?.contrastRatio,
      ),
      esito: result.passes.includes(r) ? "ok" : "da verificare",
    })),
  );
  return nodes.filter((n) => Number.isFinite(n.rapporto) && n.rapporto > 0);
}

const lato = (t: Target) => Math.min(t.larghezza, t.altezza);
// Sub-pixel layout: 47.99 px renders as 48.
const sotto = (t: Target, soglia: number) =>
  t.larghezza < soglia - 0.5 || t.altezza < soglia - 0.5;

/**
 * Measures one screen: every control of the page against 24×24, and on a
 * courtside screen the controls of the content (`campo`) against 48×48.
 */
export async function misura(
  page: Page,
  schermata: Schermata,
  scope: { pagina: string; campo: string },
  vista: { name: string; width: number },
  sorgente: string,
): Promise<Misura> {
  const tutti = await misuraTarget(page, scope.pagina);
  const campo = schermata.bordoCampo
    ? await misuraTarget(page, scope.campo)
    : [];
  const misurati = schermata.bordoCampo ? campo : tutti;
  const minimo = misurati.length
    ? misurati.reduce((a, b) => (lato(b) < lato(a) ? b : a))
    : null;
  const contrasti = await misuraContrastoTabellone(page);
  const scroll = await scrollOrizzontale(page);
  return {
    schermata: schermata.id,
    vista: vista.name,
    larghezza: vista.width,
    sorgente,
    targetMinimo: minimo,
    targetSottoSoglia: [
      ...tutti.filter((t) => sotto(t, MIN_TARGET) && !t.spaziato),
      // Courtside: no spacing exception, 48×48 for every control.
      ...campo.filter(
        (t) =>
          sotto(t, MIN_TARGET_BORDO_CAMPO) &&
          !tutti.some(
            (u) =>
              u.selettore === t.selettore &&
              u.nome === t.nome &&
              sotto(u, MIN_TARGET) &&
              !u.spaziato,
          ),
      ),
    ],
    sogliaTarget: schermata.bordoCampo ? MIN_TARGET_BORDO_CAMPO : MIN_TARGET,
    contrastoMinimo: contrasti.length
      ? Math.min(...contrasti.map((c) => c.rapporto))
      : null,
    contrastoSottoSoglia: contrasti
      .filter((c) => c.rapporto < MIN_CONTRASTO_TABELLONE)
      .map(({ selettore, rapporto }) => ({ selettore, rapporto })),
    scrollOrizzontale: scroll,
  };
}

/**
 * Keyboard and zoom on a desktop page (the caller sets 1440 px). Browser
 * zoom 200% / 400% of a 1440×900 window = a 720×450 / 360×225 CSS px
 * viewport; WCAG 1.4.10 asks for 320 px, so 400% is measured at 320×256.
 */
export async function tastieraEZoom(page: Page, zoom = true) {
  const tastiera = await controllaTastiera(page);
  if (!zoom) return { tastiera };
  const original = page.viewportSize()!;
  await page.setViewportSize({ width: 720, height: 450 });
  const zoom200 = { scrollOrizzontale: await scrollOrizzontale(page) };
  await page.setViewportSize({ width: 320, height: 256 });
  const zoom400 = { scrollOrizzontale: await scrollOrizzontale(page) };
  await page.setViewportSize(original);
  return { tastiera, zoom200, zoom400 };
}

/**
 * WCAG 1.4.4 on a phone: the user's text size at 200% (root font size),
 * as e2e/layout.spec.ts does. The style is removed afterwards.
 */
export async function testo200(page: Page) {
  const tag = await page.addStyleTag({
    content: "html { font-size: 200% !important; }",
  });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(null))),
  );
  const scroll = await scrollOrizzontale(page);
  await tag.evaluate((el) => (el as Element).remove());
  return { testo200: { scrollOrizzontale: scroll } };
}

/** Attaches the measurement: `npm run a11y:report` collects them. */
export async function allega(testInfo: TestInfo, misura: Misura) {
  await testInfo.attach(`misure-${misura.schermata}-${misura.vista}`, {
    body: JSON.stringify(misura, null, 2),
    contentType: "application/json",
  });
}

export type EsitoTastiera = {
  /** Distinct elements reached with Tab. */
  fermate: number;
  /** Focused elements with no visible indicator (2.4.7). */
  senzaIndicatore: string[];
  /** Focused elements hidden under something else (2.4.11). */
  oscurati: string[];
  /** Tab stopped moving before going round (2.1.2). */
  trappola: boolean;
};

/**
 * Tabs through the page (at most `max` stops) and checks every stop:
 * focus indicator (outline or ring), not covered by a sticky header or
 * overlay, and that focus keeps moving.
 */
export async function controllaTastiera(page: Page, max = 60) {
  const esito: EsitoTastiera = {
    fermate: 0,
    senzaIndicatore: [],
    oscurati: [],
    trappola: false,
  };
  const visti = new Set<string>();
  let ripetuti = 0;
  // From the top of the page; an open dialog keeps its own initial focus
  // (blurring it would put focus behind the modal, which no user can do).
  await page.evaluate(() => {
    if (!document.querySelector("[role=dialog], [role=alertdialog]")) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    // Let focus settle: a modal's focus guard hands it on in a later frame.
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      // Base UI's focus guards hand focus on at once: not a stop.
      if (el.matches("[data-base-ui-focus-guard]")) return null;
      const id =
        el.tagName.toLowerCase() +
        (el.id ? `#${el.id}` : "") +
        `[${(el.getAttribute("aria-label") ?? el.innerText ?? "").trim().slice(0, 40)}]`;
      // Path: identifies the element even when two share a label.
      let path = "";
      for (let n: Element | null = el; n; n = n.parentElement) {
        path = `${n.tagName}:${[...(n.parentElement?.children ?? [])].indexOf(n)}/${path}`;
      }
      const has = (e: Element) => {
        const s = getComputedStyle(e);
        return (
          (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) ||
          (s.boxShadow !== "none" && s.boxShadow !== "") ||
          e.matches(":focus-visible[data-focus-ring], [data-focus-visible]")
        );
      };
      // The ring may be drawn by the control's own wrapper (field, card).
      const indicatore =
        has(el) ||
        (el.parentElement !== null &&
          el.parentElement.matches(":focus-within") &&
          has(el.parentElement));
      const r = el.getBoundingClientRect();
      let oscurato = false;
      if (r.width > 0 && r.height > 0) {
        const punti = [
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.left + 2, r.top + 2],
          [r.right - 2, r.bottom - 2],
        ].filter(
          ([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight,
        );
        // Entirely hidden = no visible point belongs to the element.
        oscurato =
          punti.length > 0 &&
          punti.every(([x, y]) => {
            const hit = document.elementFromPoint(x, y);
            return !(hit && (el.contains(hit) || hit.contains(el)));
          });
      }
      return { id, path, indicatore, oscurato };
    });
    if (!info) continue;
    if (visti.has(info.path)) {
      ripetuti++;
      if (ripetuti > 2) break;
      continue;
    }
    visti.add(info.path);
    esito.fermate++;
    if (!info.indicatore) esito.senzaIndicatore.push(info.id);
    if (info.oscurato) esito.oscurati.push(info.id);
  }
  esito.trappola = esito.fermate === 0;
  return esito;
}

/** Horizontal scroll of the page at the current size (1.4.10 reflow). */
export async function scrollOrizzontale(page: Page) {
  // Against the viewport, as storybook-a11y.spec.ts: phones (390) have
  // overlay scrollbars, so the desktop scrollbar's 15 px don't count.
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
}
