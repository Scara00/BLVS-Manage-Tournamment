import type { APIRequestContext, BrowserContext, Page } from "@playwright/test";

/**
 * BLVS-56 · the 56 screens of the WCAG 2.2 AA report (docs/a11y-report.md).
 * One entry per screen: how the e2e suite reaches it (app route on the demo
 * data, or the Storybook story for dialogs and signed-in states the demo
 * can't show), whether its controls are used courtside, and any axe rule
 * turned off with its reason. `e2e/a11y.spec.ts` and
 * `e2e/storybook-schermate.spec.ts` run axe + the measurements on each.
 *
 * Adding a screen: add an entry here and a section in docs/a11y-report.md.
 */

export type Area = "pubblica" | "giocatore" | "admin";

export type Contesto = {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
  baseURL: string;
};

export type RegolaDisattivata = {
  /** axe rule id. */
  regola: string;
  /** Why it is off: required, the report lists it. */
  motivo: string;
};

export type Schermata = {
  id: string;
  titolo: string;
  area: Area;
  /**
   * Controls used courtside, standing, often with one hand: every control
   * in the content must be at least 48×48 px. Otherwise 24×24 (WCAG 2.5.8).
   */
  bordoCampo?: boolean;
  /** In the app: returns the path, after any demo fixture it needs. */
  app?: (ctx: Contesto) => Promise<string>;
  /** Then, on the page: open the dialog or state this screen is. */
  apri?: (page: Page) => Promise<void>;
  /** Storybook story ids (the default state first). */
  storie?: readonly string[];
  disattiva?: readonly RegolaDisattivata[];
  /** Not built yet: the dependency it waits for. */
  inAttesa?: string;
};

/** Score, standing and Live elements: AAA contrast (7:1), project rule. */
export const SELETTORE_TABELLONE = [
  "[data-slot=score-digits]",
  "[data-slot=flip-digits]",
  "[data-slot=punti-cifre]",
  "[data-slot=punteggio-parziale]",
  "[data-slot=live-punteggio]",
  "[data-slot=girone-punteggio]",
  "[data-slot=live-bar]",
  "[data-slot=scoreboard-rows]",
  "[data-slot=phase-badge]",
  "[data-punti]",
].join(", ");

async function json<T>(
  request: APIRequestContext,
  url: string,
  data?: unknown,
): Promise<T> {
  const res = await request.post(url, data === undefined ? {} : { data });
  if (!res.ok()) throw new Error(`${url}: HTTP ${res.status()}`);
  return (await res.json()) as T;
}

const percorso = (p: string) => async () => p;

/** A demo stage in progress with matches to enter (BLVS-32). */
async function tappaInCorso({ request }: Contesto) {
  return json<{ id: string; partitaId?: string }>(
    request,
    "/api/demo/inserimento-punteggio",
    { inCorso: true },
  );
}

export const SCHERMATE: readonly Schermata[] = [
  // ── Accesso e pagine pubbliche ────────────────────────────────────────
  {
    id: "w-login",
    titolo: "Accesso",
    area: "pubblica",
    app: percorso("/accesso"),
  },
  {
    id: "w-signup",
    titolo: "Registrazione",
    area: "pubblica",
    app: percorso("/registrati"),
  },
  {
    id: "w-email-verify",
    titolo: "Conferma email",
    area: "pubblica",
    app: percorso("/registrati/conferma-email"),
  },
  {
    id: "w-forgot",
    titolo: "Password dimenticata",
    area: "pubblica",
    app: percorso("/password-dimenticata"),
  },
  {
    id: "w-forgot-sent",
    titolo: "Email di reimpostazione inviata",
    area: "pubblica",
    // The app reaches it only after a real Auth call.
    storie: [
      "accesso-email-inviata--default",
      "accesso-email-inviata--testo-lungo",
    ],
  },
  {
    id: "w-reset",
    titolo: "Reimposta password",
    area: "pubblica",
    app: percorso("/reimposta-password?token_hash=hash-di-prova"),
  },
  {
    id: "w-sessione-scaduta",
    titolo: "Sessione scaduta",
    area: "pubblica",
    app: percorso("/sessione-scaduta?da=%2Fclassifica"),
  },
  {
    id: "w-privacy",
    titolo: "Informativa privacy",
    area: "pubblica",
    app: percorso("/privacy"),
  },
  {
    id: "w-account-eliminato",
    titolo: "Account cancellato",
    area: "pubblica",
    app: percorso("/account-cancellato"),
  },
  {
    id: "w-404",
    titolo: "Pagina non trovata",
    area: "pubblica",
    app: percorso("/questa-rotta-non-esiste"),
  },
  {
    id: "w-403",
    titolo: "Accesso negato",
    area: "pubblica",
    app: percorso("/admin/anteprima/403"),
  },
  {
    id: "w-503",
    titolo: "Servizio non disponibile",
    area: "pubblica",
    app: percorso("/anteprima/503"),
  },

  // ── Giocatore ─────────────────────────────────────────────────────────
  {
    id: "w-home",
    titolo: "Home del giocatore (giorno di gara)",
    area: "giocatore",
    bordoCampo: true,
    app: async ({ context, baseURL }) => {
      await context.addCookies([
        { name: "blvs_demo_oggi", value: "2027-06-14", url: baseURL },
      ]);
      return "/";
    },
  },
  {
    id: "w-tappe",
    titolo: "Elenco tappe",
    area: "giocatore",
    app: percorso("/tappe"),
  },
  {
    id: "w-tappa",
    titolo: "Dettaglio tappa",
    area: "giocatore",
    app: percorso("/tappe/rimini"),
  },
  {
    id: "w-iscrizione-ok",
    titolo: "Iscrizione confermata",
    area: "giocatore",
    app: percorso("/tappe/rimini/iscrizione"),
  },
  {
    id: "w-annulla-iscrizione",
    titolo: "Annulla iscrizione (dialog)",
    area: "giocatore",
    app: async (ctx) => {
      await json(ctx.request, "/api/demo/mie-iscrizioni");
      return "/iscrizioni";
    },
    apri: async (page) => {
      await page
        .getByRole("button", { name: "Annulla l'iscrizione" })
        .first()
        .click();
      await page.getByRole("alertdialog").waitFor();
    },
  },
  {
    id: "w-mie-iscrizioni",
    titolo: "Le mie iscrizioni",
    area: "giocatore",
    app: async (ctx) => {
      await json(ctx.request, "/api/demo/mie-iscrizioni");
      return "/iscrizioni";
    },
  },
  {
    id: "w-live",
    titolo: "Live della tappa",
    area: "giocatore",
    bordoCampo: true,
    app: async (ctx) => `/tappe/${(await tappaInCorso(ctx)).id}/live`,
  },
  {
    id: "w-girone",
    titolo: "Pagina del girone",
    area: "giocatore",
    bordoCampo: true,
    app: async (ctx) => `/tappe/${(await tappaInCorso(ctx)).id}/live`,
    apri: async (page) => {
      await page.getByTestId("live-mio-girone-link").click();
      await page.waitForURL(/\/gironi\//);
    },
  },
  {
    id: "w-tabellone",
    titolo: "Gironi e fasi",
    area: "giocatore",
    app: async (ctx) => `/tappe/${(await tappaInCorso(ctx)).id}/tabellone`,
  },
  {
    id: "w-classifica-tappa",
    titolo: "Classifica di tappa",
    area: "giocatore",
    app: async ({ request }) => {
      const { id } = await json<{ id: string }>(
        request,
        "/api/demo/chiusura-tabellone",
        { scenario: "finali_concluse" },
      );
      return `/tappe/${id}/classifica`;
    },
  },
  {
    id: "w-classifica",
    titolo: "Classifica generale",
    area: "giocatore",
    app: percorso("/classifica"),
  },
  {
    id: "w-giocatore",
    titolo: "Scheda del giocatore",
    area: "giocatore",
    app: percorso(
      "/classifica/giocatore/demo-u-m-01?categoria=M&stagione=2026",
    ),
  },
  {
    id: "w-regole",
    titolo: "Regole e punteggi",
    area: "giocatore",
    app: percorso("/regole"),
  },
  {
    id: "w-profilo",
    titolo: "Profilo",
    area: "giocatore",
    // The demo has no signed-in profile (it shows «Sessione scaduta»).
    storie: [
      "profilo-schermate--profilo-default",
      "profilo-schermate--profilo-testo-200",
    ],
  },
  {
    id: "w-profilo-modifica",
    titolo: "Modifica profilo",
    area: "giocatore",
    storie: [
      "profilo-schermate--modifica",
      "profilo-schermate--modifica-errori-campi",
      "profilo-schermate--dialog-modifiche-non-salvate",
    ],
  },
  {
    id: "w-impostazioni",
    titolo: "Impostazioni",
    area: "giocatore",
    app: percorso("/impostazioni"),
  },
  {
    id: "w-elimina-account",
    titolo: "Elimina account",
    area: "giocatore",
    app: percorso("/impostazioni/elimina-account"),
  },
  {
    id: "w-live-circuito",
    titolo: "Live del circuito e gironi (BLVS-09)",
    area: "giocatore",
    bordoCampo: true,
    app: percorso("/live"),
  },

  // ── Amministrazione ───────────────────────────────────────────────────
  {
    id: "w-admin-dashboard",
    titolo: "Dashboard",
    area: "admin",
    app: percorso("/admin"),
  },
  {
    id: "w-admin-tappe",
    titolo: "Elenco tappe (admin)",
    area: "admin",
    app: percorso("/admin/tappe"),
  },
  {
    id: "w-admin-tappa-nuova",
    titolo: "Nuova tappa",
    area: "admin",
    app: percorso("/admin/tappe/nuova"),
  },
  {
    id: "w-admin-tappa",
    titolo: "Gestione tappa",
    area: "admin",
    app: percorso("/admin/tappe/jesolo"),
  },
  {
    id: "w-admin-tappa-modifica",
    titolo: "Modifica tappa",
    area: "admin",
    app: percorso("/admin/tappe/rimini/modifica"),
  },
  {
    id: "w-admin-stato-conferma",
    titolo: "Conferma cambio stato (dialog)",
    area: "admin",
    storie: [
      "admin-conferma-cambio-stato--apertura",
      "admin-conferma-cambio-stato--testo-200",
    ],
  },
  {
    id: "w-admin-annulla-tappa",
    titolo: "Annulla tappa (dialog)",
    area: "admin",
    storie: [
      "admin-annulla-tappa--default",
      "admin-annulla-tappa--motivo-mancante",
    ],
  },
  {
    id: "w-admin-iscritti",
    titolo: "Iscritti della tappa",
    area: "admin",
    app: percorso("/admin/tappe/jesolo/iscritti"),
  },
  {
    id: "w-admin-aggiungi-giocatore",
    titolo: "Aggiungi giocatore (dialog)",
    area: "admin",
    storie: [
      "admin-aggiungi-giocatore--risultati",
      "admin-aggiungi-giocatore--testo-200",
    ],
  },
  {
    id: "w-admin-iscrizioni",
    titolo: "Iscrizioni (tutte le tappe)",
    area: "admin",
    app: percorso("/admin/iscrizioni"),
  },
  {
    id: "w-admin-gironi",
    titolo: "Editor dei gironi",
    area: "admin",
    app: percorso("/admin/tappe/jesolo/gironi/m"),
  },
  {
    id: "w-admin-sposta",
    titolo: "Sposta giocatore (dialog)",
    area: "admin",
    storie: [
      "admin-editor-dei-gironi--sposta-destinazione",
      "admin-editor-dei-gironi--sposta-testo-200",
    ],
  },
  {
    id: "w-admin-rigenera-conferma",
    titolo: "Rigenera gironi (dialog)",
    area: "admin",
    storie: [
      "admin-rigenera-gironi--con-punteggi",
      "admin-rigenera-gironi--testo-200",
    ],
  },
  {
    id: "w-admin-avvio-fase",
    titolo: "Avvio fase",
    area: "admin",
    app: async ({ request }) => {
      const { id } = await json<{ id: string }>(
        request,
        "/api/demo/avvio-fase",
      );
      return `/admin/tappe/${id}/avvio/m`;
    },
  },
  {
    id: "w-admin-live",
    titolo: "Gestione live del tabellone",
    area: "admin",
    bordoCampo: true,
    app: async (ctx) => `/admin/tappe/${(await tappaInCorso(ctx)).id}/live/m`,
  },
  {
    id: "w-admin-punteggi",
    titolo: "Punteggi della tappa",
    area: "admin",
    bordoCampo: true,
    app: async (ctx) => `/admin/tappe/${(await tappaInCorso(ctx)).id}/punteggi`,
  },
  {
    id: "w-admin-punteggio",
    titolo: "Inserimento punteggio",
    area: "admin",
    bordoCampo: true,
    app: async (ctx) => {
      const { id, partitaId } = await tappaInCorso(ctx);
      return `/admin/tappe/${id}/punteggi/${partitaId}`;
    },
  },
  {
    id: "w-admin-punteggio-riepilogo",
    titolo: "Riepilogo del punteggio",
    area: "admin",
    bordoCampo: true,
    storie: [
      "admin-punteggio--riepilogo",
      "admin-punteggio--testo-200-riepilogo",
    ],
  },
  {
    id: "w-admin-conflitto",
    titolo: "Conflitto tra admin (dialog)",
    area: "admin",
    bordoCampo: true,
    storie: [
      "admin-conflitto-punteggio--conflitto",
      "admin-conflitto-punteggio--conferma-sovrascrittura",
    ],
  },
  {
    id: "w-admin-correzione",
    titolo: "Correzione e impatto sulla fase",
    area: "admin",
    bordoCampo: true,
    storie: [
      "admin-punteggio-correzione--vincitore-ribaltato",
      "admin-punteggio-impatto-sulla-fase--scelta",
    ],
  },
  {
    id: "w-admin-parita",
    titolo: "Risoluzione parità (dialog)",
    area: "admin",
    bordoCampo: true,
    storie: ["admin-risoluzione-parità--tre-giocatori"],
  },
  {
    id: "w-admin-ritiro",
    titolo: "Ritiro o assenza (dialog)",
    area: "admin",
    bordoCampo: true,
    storie: [
      "admin-ritiro-o-assenza--anteprima",
      "admin-ritiro-o-assenza--impatto-sulla-fase",
    ],
  },
  {
    id: "w-admin-registro",
    titolo: "Registro dei punteggi",
    area: "admin",
    app: percorso("/admin/tappe/jesolo/registro"),
  },
  {
    id: "w-admin-sessione",
    titolo: "Sessione admin scaduta",
    area: "admin",
    app: percorso("/admin/anteprima/bozza"),
  },

  // ── In attesa delle dipendenze ───────────────────────────────────────
  {
    id: "w-admin-classifiche",
    titolo: "Classifiche e CSV (admin)",
    area: "admin",
    inAttesa: "BLVS-45 non ancora integrato su main",
  },
  {
    id: "w-palette-comandi",
    titolo: "Palette dei comandi",
    area: "admin",
    inAttesa: "BLVS-55 non ancora integrato su main",
  },
];
