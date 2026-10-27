# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-27)

## Corpus Check
- 295 files · ~75,437 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1303 nodes · 2458 edges · 76 communities (62 shown, 14 thin omitted)
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
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]

## God Nodes (most connected - your core abstractions)
1. `BodyReader` - 22 edges
2. `readSupabaseEnv()` - 21 edges
3. `jsonError()` - 18 edges
4. `scripts` - 17 edges
5. `invalid()` - 17 edges
6. `getLiveBus()` - 16 edges
7. `compilerOptions` - 16 edges
8. `expectNoA11yViolations()` - 15 edges
9. `Button()` - 15 edges
10. `useReducedMotion()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Time()` --calls--> `formatLiveTime()`  [EXTRACTED]
  src/components/live/live-bar.tsx → src/lib/live/format.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `gotoClosed()` --calls--> `gotoStory()`  [EXTRACTED]
  e2e/storybook-overlays.spec.ts → e2e/storybook-helpers.ts
- `AnteprimaErrore()` --calls--> `isErrorPreviewEnabled()`  [EXTRACTED]
  src/app/(giocatore)/anteprima/503/page.tsx → src/lib/errors/preview.ts
- `ClassificaContent()` --calls--> `readLiveSync()`  [EXTRACTED]
  src/app/(giocatore)/classifica/page.tsx → src/lib/live/read.ts

## Import Cycles
- None detected.

## Communities (76 total, 14 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (28): devDependencies, @axe-core/playwright, @electric-sql/pglite, eslint, eslint-config-next, eslint-config-prettier, eslint-plugin-storybook, http-server (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (29): Admin, AdminMobile, columns, Giocatore, GiocatoreMobile, mobile, Standing, standings (+21 more)

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
Cohesion: 0.12
Nodes (14): backoffDelay(), createDeduper(), createLiveConnection(), EventSourceLike, LiveStatus, FakeNetwork, setup(), announcementFor() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (5): Branch e pull request, Branch protection di `main` (da configurare su GitHub), Contribuire, Prima di aprire la PR, Regole

### Community 9 - "Community 9"
Cohesion: 0.12
Nodes (14): nextConfig, enforceHttps(), isApiPath(), isHttpsEnforced(), config, RouteHandler, serve(), proxy() (+6 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (21): geistMono, geistSans, metadata, Providers(), figtree, fontVariables, mono, outfit (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (21): metadata, signOut(), initialSignOutState, SignOutState, useMediaQuery(), AdminSidebar(), AppShell(), adminNav (+13 more)

### Community 12 - "Community 12"
Cohesion: 0.21
Nodes (11): ActionLink(), ErrorBoard(), ErrorBoardProps, ForbiddenContent(), Role, roleLabels, NotFoundContent(), ScoreboardRow (+3 more)

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
Cohesion: 0.22
Nodes (9): formatExpiry(), formatValidity(), EmailPreview(), EmailVerifyScreen(), EmailVerifyScreenProps, T0, RegistrationSteps(), ResendPanel() (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (16): FieldContext, FieldContextValue, FieldControlOwnProps, FieldError(), FieldHint(), FieldMessagesProps, FieldProps, FieldsetProps (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): Badge(), BadgeContent, BadgeProps, badgeVariants, Caricamento, Default, Errore, Pillola (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (32): columns, metadata, stats, ClassificaContent(), columns, metadata, DemoGroup, DemoGroupMatch (+24 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (18): createLiveBus(), getLiveBus(), globalForLive, LiveListener, at, empty, match, publishGroupStandings() (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.13
Nodes (16): mergeIds(), Checkbox(), CheckboxProps, BordoCampo, Caricamento, ConDescrizione, Default, Disabilitato (+8 more)

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (13): EmailVerifyOutcome, EmailVerifyStatus, OUTCOMES, REGISTRATION_STEPS, ResendError, ResendResponse, clearPendingVerification(), decodePending() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.14
Nodes (20): LiveBar(), LiveBarConnected(), LiveBarProps, Time(), LiveLoading(), useLive(), ClassificaOffline, Girone (+12 more)

### Community 33 - "Community 33"
Cohesion: 0.05
Nodes (50): withText200(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+42 more)

### Community 34 - "Community 34"
Cohesion: 0.09
Nodes (23): ADMIN_GUARD, AdminUser, Handler, withAdmin(), CurrentUser, Categoria, CATEGORIE, Iscrizione (+15 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (5): Default, Interattivo, Orario, RiduzioneMovimento, Story

### Community 36 - "Community 36"
Cohesion: 0.28
Nodes (7): Message, Field(), focusFirstInvalid(), Default, Errors, ModuloIscrizione(), Story

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (9): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Obbligatorio, Story (+1 more)

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
Nodes (29): AppFooter(), MinimalShell(), SkipLink(), dateFormatter, formatPolicyDate(), PRIVACY_CONTROLLER, PRIVACY_POLICY_VERSION, PrivacyPolicyVersion (+21 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (7): Phase, PrivacySampleRow(), SAMPLE_ROW, FlipDigits(), FlipDigitsProps, usePrefersReducedMotion(), useReducedMotion()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): ScoreDigits(), ScoreDigitsProps, Classifica, Default, RiduzioneMovimento, Story, Toni, tones

### Community 46 - "Community 46"
Cohesion: 0.20
Nodes (17): ApiErrorBody, dbErrorResponse(), FieldErrors, forbidden(), jsonError(), malformedBody(), notFound(), PostgrestLikeError (+9 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (22): ETICHETTE_EVENTO_REGISTRO, TIPI_EVENTO_REGISTRO, TipoEventoRegistro, ErroreRegistro, formatOraRegistro(), NuovoEventoRegistro, registraEvento(), MIGRATION (+14 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (15): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.42
Nodes (7): FieldSize, useFieldControl(), controlVariants, Input(), InputProps, Select(), SelectProps

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (5): { getCurrentUser }, Handler, HTTP_METHODS, modules, routes

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (5): engines, node, name, private, version

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (3): { rememberPendingVerification }, { signInWithPassword, signUp, signOut }, validRegistration

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (16): noContent(), AuthAction, clientIp(), createMemoryRateLimitStore(), createSupabaseRateLimitStore(), getStore(), RateLimitHit, RateLimitStore (+8 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (18): LiveConnectionOptions, LiveAnnouncer(), renderLive(), Action, EventListener, LiveContext, LiveContextValue, LiveProvider() (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): Connessione, Live, Offline, Riconnessione, RiduzioneMovimento, Story, Testo200

### Community 58 - "Community 58"
Cohesion: 0.34
Nodes (10): invalid(), readJsonObject(), limitAuthAttempt(), rememberPendingVerification(), POST(), POST(), POST(), retryAfterSeconds() (+2 more)

### Community 59 - "Community 59"
Cohesion: 0.21
Nodes (11): Disabilitata, MOLTE, MolteSchede, Predefinito, SEZIONI, Story, Testo200, Tabs() (+3 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (8): readTappa(), STATI_TAPPA, DELETE, GET, Context, PATCH, GET, POST

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (31): SUPABASE_DIR, accodaEmail(), EmailAccodata, ErroreCodaEmail, props, EmailTemplateName, EmailTemplateProps, emailTemplates (+23 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (13): describeError(), EmailMessage, EmailQueueLogger, EmailQueueResult, EmailQueueStore, EmailTransport, processEmailQueue(), QueuedEmail (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.33
Nodes (4): AnteprimaForbidden(), Guasto(), AnteprimaErrore(), isErrorPreviewEnabled()

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (15): extractLinks(), getLatestLink(), HTML_ENTITIES, isMailpitAvailable(), mailpit(), MAILPIT_URL, MailpitMessage, MailpitSummary (+7 more)

### Community 66 - "Community 66"
Cohesion: 0.29
Nodes (8): EmailVerifyState(), isConfirmed(), metadata, resolveState(), readOutcome(), formatCountdown(), linkExpiresAt(), resendWaitSeconds()

### Community 68 - "Community 68"
Cohesion: 0.23
Nodes (12): LiveBus, formatSseEvent(), formatSsePing(), formatSseResync(), parseSeq(), createLiveStream(), SSE_HEADERS, GET() (+4 more)

### Community 69 - "Community 69"
Cohesion: 0.20
Nodes (9): Default, Loading, LongText, PermissionDenied, ReinvioBloccato, SessionExpired, SessionExpiredSenzaEmail, Story (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.22
Nodes (5): gotrue, { jar }, pendingCookie(), T0, encodePending()

### Community 72 - "Community 72"
Cohesion: 0.40
Nodes (4): Admin, Default, Story, Testo200

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (4): Caricamento, Default, Story, Testo200

### Community 75 - "Community 75"
Cohesion: 0.50
Nodes (3): Default, Story, Testo200

## Knowledge Gaps
- **475 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+470 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `Community 28` to `Community 66`, `Community 67`, `Community 36`, `Community 68`, `Community 55`, `Community 58`, `Community 29`, `Community 62`, `Community 31`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 33` to `Community 35`, `Community 36`, `Community 42`, `Community 10`, `Community 12`, `Community 30`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `readSupabaseEnv()` connect `Community 55` to `Community 34`, `Community 9`, `Community 11`, `Community 46`, `Community 58`, `Community 31`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _475 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06342780026990553 - nodes in this community are weakly interconnected._