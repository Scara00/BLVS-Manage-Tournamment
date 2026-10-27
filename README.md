# BLVS-Manage-Tournamment

Web app per la gestione di tornei (BLVS – Manage Tournament).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, Cache Components) + React 19 + TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (style `base-nova`, primitives `@base-ui/react`, icone `lucide-react`)
- [Supabase](https://supabase.com) via `@supabase/ssr` (client in `src/lib/supabase/`)
- Test: Vitest + Testing Library (unit), Playwright + axe-core (e2e, WCAG 2.2 AA)
- Storybook 10 (`@storybook/nextjs-vite`) con addon a11y e viewport 390/1440 px
- Prettier + ESLint, CI su GitHub Actions (`.github/workflows/ci.yml`)

## Requisiti

- Node.js 24 (vedi `.nvmrc`, usa `nvm use`)
- npm (package manager del progetto)

## Setup

```bash
npm install
cp .env.example .env.local   # poi inserisci URL e publishable key di Supabase
npx playwright install chromium   # solo per i test e2e
```

## Database (Supabase)

Schema, vincoli e permessi stanno in `supabase/migrations/` (migrazioni versionate della Supabase CLI); i dati demo in `supabase/seed.sql`.

```bash
supabase start          # Postgres + Auth in locale (richiede Docker)
supabase db reset       # applica le migrazioni e carica i dati demo
supabase link --project-ref <ref> && supabase db push   # applica le migrazioni al progetto remoto
```

Account demo (solo in locale): `admin@blvs.test` (admin), `marco.rossi@blvs.test`, `giulia.colombo@blvs.test` e gli altri giocatori in `seed.sql`; password `Demo-BLVS-2026!`.

- **Tabelle**: `utenti` (profilo di `auth.users`: ruolo, categoria, email unica senza distinzione di maiuscole), `tappe`, `tabelloni` (sempre M e F, creati da un trigger), `iscrizioni` (un giocatore per riga, unica per utente e tappa), `gironi`, `partite` + `partita_giocatori` (squadre A/B a rotazione), `punteggi` (con `versione` per la concorrenza ottimistica), `registro` (scritto dai trigger, in sola aggiunta), `consensi` (storico in sola aggiunta), `auth_rate_limits`.
- **Permessi**: RLS su ogni tabella. Il ruolo vive solo in `utenti.ruolo`; un nuovo account è sempre `giocatore` e solo un admin può cambiare ruolo.
- **Password**: le gestisce Supabase Auth (hash bcrypt in `auth.users`); l'app non le salva né le registra mai.
- **Test**: `src/lib/db/schema.test.ts` applica le migrazioni e il seed a un Postgres in memoria (PGlite), quindi non serve Docker.

## API

Route Handler JSON sotto `src/app/api/`. Gli errori hanno la forma `{ error, fields? }` (`src/lib/api/responses.ts`).

- `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/register` (solo giocatori, con consenso privacy). Login e registrazione hanno un limite ai tentativi per IP e per email (`src/lib/auth/rate-limit.ts`): oltre il limite rispondono 429 con `Retry-After`.
- `/api/admin/*` (tappe, iscrizioni, punteggi, utenti, registro): ogni handler è avvolto da `withAdmin` (`src/lib/auth/guards.ts`), che verifica sessione e ruolo sul server e risponde 403 in ogni altro caso. Il test `src/app/api/admin/admin-routes.test.ts` trova da solo ogni nuova rotta e fallisce se non è protetta.
- Con `ENFORCE_HTTPS=true` le API in HTTP ricevono 403 `HTTPS obbligatorio.` invece del redirect delle pagine.

## Script

| Comando                   | Descrizione                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run dev`             | Server di sviluppo su http://localhost:3000                                                    |
| `npm run build`           | Build di produzione                                                                            |
| `npm run start`           | Avvia la build di produzione                                                                   |
| `npm run lint`            | ESLint                                                                                         |
| `npm test`                | Test unitari (Vitest, run singolo)                                                             |
| `npm run test:watch`      | Vitest in watch mode                                                                           |
| `npm run test:e2e`        | Test e2e Playwright + axe su app e Storybook, a 390 e 1440 px (fa build + start in automatico) |
| `npm run format`          | Formatta con Prettier (`format:check` per la sola verifica)                                    |
| `npm run typecheck`       | `next typegen` + `tsc --noEmit`                                                                |
| `npm run storybook`       | Storybook su http://localhost:6006                                                             |
| `npm run build-storybook` | Build statica di Storybook in `storybook-static/`                                              |
| `npm run ci`              | format:check, lint, typecheck, test, build                                                     |

## CI

Ogni PR verso `main` esegue tre job: qualità (Prettier, ESLint, typecheck, test unitari, anche con `TZ=UTC`), build di Storybook ed e2e Playwright. Gli e2e lanciano axe-core con le regole WCAG 2.2 AA sulle pagine e su ogni story, e falliscono a ogni violazione. Convenzioni dei branch e branch protection in [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploy (Vercel)

Staging e produzione girano solo su HTTPS:

- imposta `ENFORCE_HTTPS=true` nelle variabili d'ambiente di Vercel (Preview e Production). Il Proxy reindirizza ogni richiesta HTTP su HTTPS con un 308 e `next.config.ts` invia `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. Vercel fa già il redirect a livello di edge, anche per gli asset statici esclusi dal matcher del Proxy;
- l'orario del server è sempre `Europe/Rome`: lo fornisce `src/lib/time/server-time.ts`, indipendentemente dal fuso del processo (le funzioni Vercel girano in UTC). All'avvio `src/instrumentation.ts` registra l'ora e avvisa se il processo non è su `Europe/Rome`.

## Struttura

- `src/app/` — route (App Router)
- `src/components/ui/` — componenti shadcn/ui (aggiungili con `npx shadcn@latest add <nome>`)
- `src/lib/` — utility (`cn` in `utils.ts`, client Supabase in `supabase/`)
- `src/proxy.ts` — Proxy Next.js (ex middleware): rinnova la sessione Supabase a ogni richiesta (`updateSession` in `src/lib/supabase/proxy.ts`). Senza variabili d'ambiente Supabase il refresh è disattivato con un warning, così build/e2e funzionano anche senza progetto collegato.
- `src/lib/time/server-time.ts` — helper unico dell'orario del server (`now()`, fuso `Europe/Rome`)
- `src/lib/security/https.ts` — redirect HTTP → HTTPS (403 per le API) e valore HSTS
- `supabase/` — configurazione CLI, migrazioni e dati demo
- `src/lib/auth/` — sessione (`getCurrentUser`), guard `withAdmin`, limite ai tentativi
- `src/app/api/` — API JSON (auth e admin)
- `.storybook/` — configurazione Storybook; le story stanno accanto ai componenti (`*.stories.tsx`)
- `e2e/` — test Playwright (`fixtures.ts` contiene `expectNoA11yViolations`); i test unitari stanno accanto al codice (`*.test.ts[x]`)
- Alias di import: `@/*` → `src/*`
