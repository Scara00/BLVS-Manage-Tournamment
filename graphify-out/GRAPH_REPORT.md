# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-26)

## Corpus Check
- 37 files · ~5,007 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 209 nodes · 219 edges · 25 communities (17 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1b315058`
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 14 edges
3. `BLVS-Manage-Tournamment` - 8 edges
4. `tailwind` - 6 edges
5. `aliases` - 6 edges
6. `getSupabaseEnv()` - 6 edges
7. `enforceHttps()` - 5 edges
8. `updateSession()` - 5 edges
9. `Contribuire` - 5 edges
10. `expectNoA11yViolations()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `proxy()` --calls--> `enforceHttps()`  [EXTRACTED]
  src/proxy.ts → src/lib/security/https.ts
- `createClient()` --calls--> `getSupabaseEnv()`  [EXTRACTED]
  src/lib/supabase/client.ts → src/lib/supabase/env.ts
- `updateSession()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/proxy.ts → src/lib/supabase/proxy.test.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `register()` --calls--> `formatServerTime()`  [EXTRACTED]
  src/instrumentation.ts → src/lib/time/server-time.ts

## Import Cycles
- None detected.

## Communities (25 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (26): devDependencies, @axe-core/playwright, eslint, eslint-config-next, eslint-config-prettier, eslint-plugin-storybook, http-server, jsdom (+18 more)

### Community 2 - "Community 2"
Cohesion: 0.11
Nodes (18): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (14): scripts, build, build-storybook, ci, dev, format, format:check, lint (+6 more)

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
Cohesion: 0.20
Nodes (11): config, proxy(), createClient(), getSupabaseEnv(), readSupabaseEnv(), SupabaseEnv, createServerClient, getClaims (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (9): Button(), buttonVariants, ConIcona, Default, Dimensioni, Disabilitato, SoloIcona, Story (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (3): nextConfig, enforceHttps(), isHttpsEnforced()

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (6): expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, StoryIndex, VIEWPORTS

## Knowledge Gaps
- **135 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+130 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `scripts` connect `Community 4` to `Community 2`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _135 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._