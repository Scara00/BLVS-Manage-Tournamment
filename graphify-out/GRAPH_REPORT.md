# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-26)

## Corpus Check
- 65 files · ~10,594 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 329 nodes · 408 edges · 26 communities (19 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a5a9cf4`
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 15 edges
3. `useReducedMotion()` - 8 edges
4. `BLVS-Manage-Tournamment` - 8 edges
5. `tailwind` - 6 edges
6. `aliases` - 6 edges
7. `getSupabaseEnv()` - 6 edges
8. `expectNoA11yViolations()` - 5 edges
9. `FlipDigits()` - 5 edges
10. `Tape()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `createClient()` --calls--> `getSupabaseEnv()`  [EXTRACTED]
  src/lib/supabase/client.ts → src/lib/supabase/env.ts
- `updateSession()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/proxy.ts → src/lib/supabase/proxy.test.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `FlipDigits()` --calls--> `useReducedMotion()`  [EXTRACTED]
  src/components/scoreboard/flip-digits.tsx → src/components/scoreboard/use-prefers-reduced-motion.ts
- `Tape()` --calls--> `useReducedMotion()`  [EXTRACTED]
  src/components/scoreboard/tape.tsx → src/components/scoreboard/use-prefers-reduced-motion.ts

## Import Cycles
- None detected.

## Communities (26 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (26): devDependencies, @axe-core/playwright, eslint, eslint-config-next, eslint-config-prettier, eslint-plugin-storybook, http-server, jsdom (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (20): engines, node, name, private, scripts, build, build-storybook, ci (+12 more)

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
Cohesion: 0.13
Nodes (14): nextConfig, enforceHttps(), isHttpsEnforced(), config, proxy(), createClient(), getSupabaseEnv(), readSupabaseEnv() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (9): geistMono, geistSans, metadata, figtree, fontVariables, mono, outfit, preview (+1 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (14): Default, Interattivo, Orario, RiduzioneMovimento, Story, Button(), buttonVariants, ConIcona (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): Colori, GROUPS, KIND_LABEL, Story, Swatch(), DocPage(), DocSection(), densities (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (8): expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, StoryIndex, VIEWPORTS, StoryIndex, VIEWPORTS

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (18): Category, CategoryLabel(), CategoryLabelProps, labels, Default, Femminile, Story, FlipDigits() (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (8): Phase, PhaseBadge(), PhaseBadgeProps, phases, Default, Fasi, RiduzioneMovimento, Story

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (8): ScoreDigits(), ScoreDigitsProps, Classifica, Default, RiduzioneMovimento, Story, Toni, tones

## Knowledge Gaps
- **181 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+176 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 4`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _181 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._