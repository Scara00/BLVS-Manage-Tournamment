# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-26)

## Corpus Check
- 21 files · ~1,904 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 131 nodes · 128 edges · 18 communities (13 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `64da4cdc`
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
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `scripts` - 9 edges
3. `tailwind` - 6 edges
4. `aliases` - 6 edges
5. `getSupabaseEnv()` - 6 edges
6. `BLVS-Manage-Tournamment` - 6 edges
7. `updateSession()` - 5 edges
8. `readSupabaseEnv()` - 4 edges
9. `createServerClient` - 3 edges
10. `createClient()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `createClient()` --calls--> `getSupabaseEnv()`  [EXTRACTED]
  src/lib/supabase/client.ts → src/lib/supabase/env.ts
- `updateSession()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/proxy.ts → src/lib/supabase/proxy.test.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `proxy()` --calls--> `updateSession()`  [EXTRACTED]
  src/proxy.ts → src/lib/supabase/proxy.ts
- `updateSession()` --calls--> `readSupabaseEnv()`  [EXTRACTED]
  src/lib/supabase/proxy.ts → src/lib/supabase/env.ts

## Import Cycles
- None detected.

## Communities (18 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (15): devDependencies, eslint, eslint-config-next, jsdom, @playwright/test, tailwindcss, @tailwindcss/turbopack, @testing-library/dom (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (13): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (15): iconLibrary, menuAccent, menuColor, registries, rsc, rtl, $schema, style (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (14): engines, node, name, private, scripts, build, dev, lint (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (6): BLVS-Manage-Tournamment, Requisiti, Script, Setup, Stack, Struttura

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (6): aliases, components, hooks, lib, ui, utils

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (11): config, proxy(), createClient(), getSupabaseEnv(), readSupabaseEnv(), SupabaseEnv, createServerClient, getClaims (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

## Knowledge Gaps
- **89 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 1` to `Community 4`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 2` to `Community 4`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._