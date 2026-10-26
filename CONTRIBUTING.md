# Contribuire

## Branch e pull request

- Per ogni task crea un branch `feature/BLVS-xx-descrizione` partendo da `main`.
- Apri la PR verso `main`: si può fare merge solo con la CI verde.

## Branch protection di `main` (da configurare su GitHub)

In **Settings → Branches → Branch protection rules** (o un ruleset) per `main`:

1. _Require a pull request before merging_.
2. _Require status checks to pass before merging_ e _Require branches to be up to date_, con i check obbligatori del workflow `CI`:
   - `Lint, typecheck e test unitari`
   - `Build Storybook`
   - `E2E Playwright + axe (WCAG 2.2 AA)`
3. _Do not allow bypassing the above settings_.

## Prima di aprire la PR

```bash
npm run ci                # format:check, lint, typecheck, test, build
npm run build-storybook
npm run test:e2e          # Playwright + axe su pagine e story, a 390 e 1440 px
```

## Regole

- **Orario del server**: usa sempre `now()`, `getServerTimeParts()` e `formatServerTime()` da `@/lib/time/server-time` (fuso `Europe/Rome`). ESLint blocca `new Date()` senza argomenti e `Date.now()` fuori da quel modulo.
- **Accessibilità (WCAG 2.2 AA)**: ogni spec e2e che visita una pagina chiama `expectNoA11yViolations(page)` da `e2e/fixtures.ts`. Ogni componente ha una story in `*.stories.tsx`: lo spec `e2e/storybook-a11y.spec.ts` la verifica con axe a 390 e 1440 px.
- **Token del design system**: i token BLVS Court (colori, font, spaziatura, raggi) vivono in `src/lib/design-tokens/tokens.ts` e sono rispecchiati come variabili CSS in `src/app/globals.css` (`--blvs-*` in `:root`, esposti a Tailwind in `@theme`). Modifica sempre i due file insieme: `tokens-css.test.ts` fallisce se divergono. Ogni nuova combinazione testo/sfondo va aggiunta a `contrastPairs`; `npm run tokens:contrast` fallisce sotto soglia (punteggi 7:1, testo 4.5:1, grafica 3:1). Usa le classi dei token (`bg-tape`, `text-live-fg`, `p-inset`, `gap-space-3`), non valori arbitrari. Il giallo tape non è mai testo su bianco. Documentazione visiva: Storybook › _Design system_.
- **Formattazione**: Prettier (`npm run format`). Le classi Tailwind sono ordinate dal plugin.
