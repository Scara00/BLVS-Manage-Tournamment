# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-27)

## Corpus Check
- 134 files · ~29,133 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 671 nodes · 1027 edges · 46 communities (37 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `abdbca23`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 15 edges
3. `Button()` - 13 edges
4. `expectNoA11yViolations()` - 9 edges
5. `PageContainer()` - 9 edges
6. `useReducedMotion()` - 8 edges
7. `useFieldControl()` - 8 edges
8. `mergeIds()` - 8 edges
9. `BLVS-Manage-Tournamment` - 8 edges
10. `tailwind` - 6 edges

## Surprising Connections (you probably didn't know these)
- `gotoClosed()` --calls--> `gotoStory()`  [EXTRACTED]
  e2e/storybook-overlays.spec.ts → e2e/storybook-helpers.ts
- `FlipDigits()` --calls--> `useReducedMotion()`  [EXTRACTED]
  src/components/scoreboard/flip-digits.tsx → src/components/scoreboard/use-prefers-reduced-motion.ts
- `Tape()` --calls--> `useReducedMotion()`  [EXTRACTED]
  src/components/scoreboard/tape.tsx → src/components/scoreboard/use-prefers-reduced-motion.ts
- `Button()` --calls--> `mergeIds()`  [EXTRACTED]
  src/components/ui/button.tsx → src/lib/utils.ts
- `Input()` --calls--> `useFieldControl()`  [EXTRACTED]
  src/components/ui/input.tsx → src/components/ui/field.tsx

## Import Cycles
- None detected.

## Communities (46 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (27): devDependencies, @axe-core/playwright, eslint, eslint-config-next, eslint-config-prettier, eslint-plugin-storybook, http-server, jsdom (+19 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (8): columns, metadata, stats, ResponsiveTable(), ResponsiveTableColumn, columns, Row, rows

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (33): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+25 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (8): BLVS-Manage-Tournamment, CI, Deploy (Vercel), Requisiti, Script, Setup, Stack, Struttura

### Community 6 - "Community 6"
Cohesion: 0.27
Nodes (9): register(), formatServerTime(), getProcessTimeZone(), getServerTimeParts(), getUtcOffsetMinutes(), now(), partsFormatter, ServerTimeParts (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (5): Branch e pull request, Branch protection di `main` (da configurare su GitHub), Contribuire, Prima di aprire la PR, Regole

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (16): signOut(), AppShell(), nextConfig, enforceHttps(), isHttpsEnforced(), config, proxy(), createClient() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): geistMono, geistSans, metadata, Providers(), figtree, fontVariables, mono, outfit (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (19): initialSignOutState, SignOutState, useMediaQuery(), AdminSidebar(), adminNav, isNavItemActive(), NavItem, playerPrimaryNav (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.13
Nodes (14): BordoCampo, Caricamento, ConIcona, Default, Dimensioni, Disabilitato, DisabilitatoConMotivo, Errore (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): Colori, GROUPS, KIND_LABEL, Story, Swatch(), DocPage(), DocSection(), densities (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (15): analyzeWhenIdle(), expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, PAGES, WIDTHS, StoryIndex (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.27
Nodes (7): Phase, PhaseBadge(), PhaseBadgeProps, phases, ScoreDigits(), ScoreDigitsProps, tones

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (12): Admin, AdminMobile, columns, Giocatore, GiocatoreMobile, mobile, Standing, standings (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (15): FieldContext, FieldContextValue, FieldControlOwnProps, FieldError(), FieldHint(), FieldMessagesProps, FieldProps, FieldsetProps (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): Badge(), BadgeContent, BadgeProps, badgeVariants, Caricamento, Default, Errore, Pillola (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (9): demoLiveMatches, DemoMatch, DemoRegistration, demoRegistrations, DemoStage, demoStages, metadata, metadata (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (12): CaptionNascosta, columns, Desktop1440, longRows, Mobile390, rows, Standing, Story (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): BordoCampo, Caricamento, ConDescrizione, Default, Disabilitato, Errore, Focus, Gruppo (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.24
Nodes (4): metadata, metadata, PageContainer(), metadata

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (4): columns, metadata, DemoStanding, demoStandings

### Community 33 - "Community 33"
Cohesion: 0.07
Nodes (37): withText200(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+29 more)

### Community 34 - "Community 34"
Cohesion: 0.21
Nodes (11): Disabilitata, MOLTE, MolteSchede, Predefinito, SEZIONI, Story, Testo200, Tabs() (+3 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (7): FlipDigits(), FlipDigitsProps, Default, Interattivo, Orario, RiduzioneMovimento, Story

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (10): Field(), Fieldset(), focusFirstInvalid(), useFieldMessages(), Default, Errors, ModuloIscrizione(), Story (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.17
Nodes (11): Input(), InputProps, BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (11): controlVariants, Select(), SelectProps, BordoCampo, Caricamento, Default, Disabilitato, Errore (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.24
Nodes (7): Default, RiduzioneMovimento, Spessa, Story, Tape(), TapeProps, mockMatchMedia()

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (7): Category, CategoryLabel(), CategoryLabelProps, labels, Default, Femminile, Story

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Story, Testo200

### Community 42 - "Community 42"
Cohesion: 0.52
Nodes (4): mergeIds(), Checkbox(), CheckboxProps, useFieldControl()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (5): Classifica, Default, RiduzioneMovimento, Story, Toni

### Community 45 - "Community 45"
Cohesion: 0.40
Nodes (4): Default, Fasi, RiduzioneMovimento, Story

## Knowledge Gaps
- **319 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+314 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button()` connect `Community 33` to `Community 35`, `Community 36`, `Community 10`, `Community 42`, `Community 12`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `FlipDigits()` connect `Community 35` to `Community 18`, `Community 43`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _319 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._