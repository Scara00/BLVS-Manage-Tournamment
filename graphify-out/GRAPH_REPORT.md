# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-27)

## Corpus Check
- 291 files · ~74,972 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1319 nodes · 2478 edges · 71 communities (60 shown, 11 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67716a82`
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
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]

## God Nodes (most connected - your core abstractions)
1. `BodyReader` - 22 edges
2. `readSupabaseEnv()` - 18 edges
3. `scripts` - 17 edges
4. `getLiveBus()` - 16 edges
5. `formatServerTime()` - 16 edges
6. `compilerOptions` - 16 edges
7. `Button()` - 15 edges
8. `safeAfterLoginPath()` - 15 edges
9. `expectNoA11yViolations()` - 14 edges
10. `useReducedMotion()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `ClassificaContent()` --calls--> `readLiveSync()`  [EXTRACTED]
  src/app/(giocatore)/classifica/page.tsx → src/lib/live/read.ts
- `LiveContent()` --calls--> `readLiveSync()`  [EXTRACTED]
  src/app/(giocatore)/live/page.tsx → src/lib/live/read.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `gotoClosed()` --calls--> `gotoStory()`  [EXTRACTED]
  e2e/storybook-overlays.spec.ts → e2e/storybook-helpers.ts
- `AnteprimaErrore()` --calls--> `isErrorPreviewEnabled()`  [EXTRACTED]
  src/app/(giocatore)/anteprima/503/page.tsx → src/lib/errors/preview.ts

## Import Cycles
- None detected.

## Communities (71 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (28): devDependencies, @axe-core/playwright, @electric-sql/pglite, eslint, eslint-config-next, eslint-config-prettier, eslint-plugin-storybook, http-server (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (12): CaptionNascosta, columns, Desktop1440, longRows, Mobile390, rows, Standing, Story (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (17): scripts, build, build-storybook, ci, dev, email:auth-templates, format, format:check (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (13): API, BLVS-Manage-Tournamment, CI, Database (Supabase), Deploy (Vercel), Email, Registro ed email, Registro (`public.registro`) (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (13): backoffDelay(), createDeduper(), createLiveConnection(), EventSourceLike, LiveStatus, FakeNetwork, setup(), Action (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (5): Branch e pull request, Branch protection di `main` (da configurare su GitHub), Contribuire, Prima di aprire la PR, Regole

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (35): LoginFormFromParams(), SessionExpired(), SessionExpiredFromParams(), AppFooter(), describeReturnPath(), loginHref(), LoginReason, matches() (+27 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): geistMono, geistSans, metadata, Providers(), figtree, fontVariables, mono, outfit (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (21): metadata, signOut(), initialSignOutState, SignOutState, useMediaQuery(), AdminSidebar(), AppShell(), adminNav (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (28): AnteprimaForbidden(), Guasto(), AnteprimaErrore(), ActionLink(), ErrorBoard(), ErrorBoardProps, ForbiddenContent(), Role (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): Colori, GROUPS, KIND_LABEL, Story, Swatch(), DocPage(), DocSection(), densities (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (21): PAGES, WIDTHS, analyzeWhenIdle(), expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, PAGES (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.24
Nodes (8): Phase, PhaseBadge(), PhaseBadgeProps, phases, Default, Fasi, RiduzioneMovimento, Story

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (12): Admin, AdminMobile, columns, Giocatore, GiocatoreMobile, mobile, Standing, standings (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (14): FieldContext, FieldContextValue, FieldControlOwnProps, FieldError(), FieldHint(), FieldMessagesProps, FieldProps, FieldsetProps (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (6): auth, redirectMock, signInWithPassword, signOutMock, valid, readSets()

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): Badge(), BadgeContent, BadgeProps, badgeVariants, Caricamento, Default, Errore, Pillola (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (15): columns, metadata, stats, DemoGroup, DemoGroupMatch, demoGroups, demoLiveMatches, DemoMatch (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (25): createLiveBus(), getLiveBus(), globalForLive, LiveListener, at, empty, match, reducer() (+17 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): BordoCampo, Caricamento, ConDescrizione, Default, Disabilitato, Errore, Focus, Gruppo (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (7): findGroup(), generateMetadata(), GironeContent(), GironePage(), readLiveSync(), GET(), now()

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (21): LiveAnnouncer(), LiveBar(), LiveBarConnected(), LiveBarProps, LiveLoading(), useLive(), ClassificaOffline, Girone (+13 more)

### Community 33 - "Community 33"
Cohesion: 0.05
Nodes (50): withText200(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+42 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (18): Categoria, CATEGORIE, Iscrizione, Punteggio, RUOLI, Ruolo, SetPunteggio, STATI_PARTITA (+10 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (5): Default, Interattivo, Orario, RiduzioneMovimento, Story

### Community 36 - "Community 36"
Cohesion: 0.23
Nodes (10): Field(), Fieldset(), focusFirstInvalid(), useFieldMessages(), Default, Errors, ModuloIscrizione(), Story (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (15): FieldSize, controlVariants, Input(), InputProps, BordoCampo, Caricamento, Default, Disabilitato (+7 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Story, Testo200

### Community 39 - "Community 39"
Cohesion: 0.28
Nodes (6): Default, RiduzioneMovimento, Spessa, Story, Tape(), TapeProps

### Community 40 - "Community 40"
Cohesion: 0.24
Nodes (7): Category, CategoryLabel(), CategoryLabelProps, labels, Default, Femminile, Story

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Story, Testo200

### Community 42 - "Community 42"
Cohesion: 0.06
Nodes (28): SessionExpiredView(), ConBozze, Default, Story, Text200, MinimalShell(), SkipLink(), dateFormatter (+20 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (7): Phase, PrivacySampleRow(), SAMPLE_ROW, FlipDigits(), FlipDigitsProps, usePrefersReducedMotion(), useReducedMotion()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): ScoreDigits(), ScoreDigitsProps, Classifica, Default, RiduzioneMovimento, Story, Toni, tones

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (21): ApiErrorBody, dbErrorResponse(), forbidden(), invalid(), jsonError(), malformedBody(), notFound(), PostgrestLikeError (+13 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (21): ETICHETTE_EVENTO_REGISTRO, TIPI_EVENTO_REGISTRO, TipoEventoRegistro, ErroreRegistro, formatOraRegistro(), NuovoEventoRegistro, registraEvento(), MIGRATION (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (15): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.60
Nodes (4): mergeIds(), Checkbox(), CheckboxProps, useFieldControl()

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (10): { getCurrentUser }, Handler, HTTP_METHODS, modules, routes, ADMIN_GUARD, AdminUser, Handler (+2 more)

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 55 - "Community 55"
Cohesion: 0.20
Nodes (14): noContent(), isAdminPath(), signIn(), rateLimitedLoginMessage(), checkAuthAttempt(), clientIp(), POST(), getSupabaseAdmin() (+6 more)

### Community 56 - "Community 56"
Cohesion: 0.18
Nodes (9): LiveConnectionOptions, renderLive(), LiveProvider(), baseSnapshot, baseSync, testConnection(), TestEventSource, animate (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): Connessione, Live, Offline, Riconnessione, RiduzioneMovimento, Story, Testo200

### Community 58 - "Community 58"
Cohesion: 0.06
Nodes (44): metadata, LoginForm(), LoginFormProps, SignInAction, SignOutFormAction, params, FORM_ERRORS, LoginFormView() (+36 more)

### Community 59 - "Community 59"
Cohesion: 0.24
Nodes (8): AuthAction, AuthAttemptCheck, createMemoryRateLimitStore(), createSupabaseRateLimitStore(), getStore(), RateLimitHit, RateLimitStore, Rule

### Community 61 - "Community 61"
Cohesion: 0.24
Nodes (8): FieldErrors, readTappa(), isUuid(), STATI_TAPPA, DELETE, GET, Context, PATCH

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (33): DraftList(), SessionExpiredViewProps, SUPABASE_DIR, accodaEmail(), EmailAccodata, ErroreCodaEmail, props, EmailTemplateName (+25 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (13): describeError(), EmailMessage, EmailQueueLogger, EmailQueueResult, EmailQueueStore, EmailTransport, processEmailQueue(), QueuedEmail (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.21
Nodes (11): Disabilitata, MOLTE, MolteSchede, Predefinito, SEZIONI, Story, Testo200, Tabs() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (14): extractLinks(), getLatestLink(), HTML_ENTITIES, isMailpitAvailable(), mailpit(), MAILPIT_URL, MailpitMessage, MailpitSummary (+6 more)

### Community 66 - "Community 66"
Cohesion: 0.16
Nodes (9): ClassificaContent(), columns, metadata, DemoStanding, ResponsiveTable(), ResponsiveTableColumn, columns, Row (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (7): announcementFor(), statusAnnouncement(), match, meta, formatLiveTime(), Time(), LiveEvent

### Community 68 - "Community 68"
Cohesion: 0.30
Nodes (9): LiveBus, formatSseEvent(), formatSsePing(), formatSseResync(), parseSeq(), createLiveStream(), SSE_HEADERS, GET() (+1 more)

### Community 69 - "Community 69"
Cohesion: 0.24
Nodes (4): metadata, metadata, PageContainer(), metadata

## Knowledge Gaps
- **485 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+480 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Button()` connect `Community 33` to `Community 35`, `Community 36`, `Community 42`, `Community 10`, `Community 12`, `Community 50`, `Community 58`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `now()` connect `Community 31` to `Community 68`, `Community 12`, `Community 46`, `Community 58`, `Community 59`, `Community 29`, `Community 62`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `formatServerTime()` connect `Community 62` to `Community 48`, `Community 67`, `Community 12`, `Community 55`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _485 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._