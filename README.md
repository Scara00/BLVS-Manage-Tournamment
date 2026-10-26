# BLVS-Manage-Tournamment

Web app per la gestione di tornei (BLVS – Manage Tournament).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, Cache Components) + React 19 + TypeScript
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (style `base-nova`, primitives `@base-ui/react`, icone `lucide-react`)
- [Supabase](https://supabase.com) via `@supabase/ssr` (client in `src/lib/supabase/`)
- Test: Vitest + Testing Library (unit) e Playwright (e2e)

## Requisiti

- Node.js 24 (vedi `.nvmrc`, usa `nvm use`)
- npm (package manager del progetto)

## Setup

```bash
npm install
cp .env.example .env.local   # poi inserisci URL e publishable key di Supabase
npx playwright install chromium   # solo per i test e2e
```

## Script

| Comando              | Descrizione                                         |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Server di sviluppo su http://localhost:3000         |
| `npm run build`      | Build di produzione                                 |
| `npm run start`      | Avvia la build di produzione                        |
| `npm run lint`       | ESLint                                              |
| `npm test`           | Test unitari (Vitest, run singolo)                  |
| `npm run test:watch` | Vitest in watch mode                                |
| `npm run test:e2e`   | Test e2e Playwright (fa build + start in automatico) |

## Struttura

- `src/app/` — route (App Router)
- `src/components/ui/` — componenti shadcn/ui (aggiungili con `npx shadcn@latest add <nome>`)
- `src/lib/` — utility (`cn` in `utils.ts`, client Supabase in `supabase/`)
- `src/proxy.ts` — Proxy Next.js (ex middleware): rinnova la sessione Supabase a ogni richiesta (`updateSession` in `src/lib/supabase/proxy.ts`). Senza variabili d'ambiente Supabase il refresh è disattivato con un warning, così build/e2e funzionano anche senza progetto collegato.
- `e2e/` — test Playwright; i test unitari stanno accanto al codice (`*.test.tsx`)
- Alias di import: `@/*` → `src/*`
