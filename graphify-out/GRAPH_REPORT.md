# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-27)

## Corpus Check
- 328 files · ~83,385 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1419 nodes · 2751 edges · 90 communities (78 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cf0cc3cf`
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
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]

## God Nodes (most connected - your core abstractions)
1. `readSupabaseEnv()` - 25 edges
2. `BodyReader` - 24 edges
3. `jsonError()` - 23 edges
4. `invalid()` - 21 edges
5. `readJsonObject()` - 18 edges
6. `scripts` - 17 edges
7. `malformedBody()` - 17 edges
8. `expectNoA11yViolations()` - 16 edges
9. `Button()` - 16 edges
10. `getLiveBus()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `pendingCookie()` --calls--> `encodePending()`  [INFERRED]
  src/app/api/auth/conferma-email/conferma-email-routes.test.ts → src/lib/auth/email-verification/pending.ts
- `reducer()` --calls--> `applyLiveEvent()`  [EXTRACTED]
  src/components/live/live-provider.tsx → src/lib/live/types.ts
- `createClient()` --calls--> `createServerClient`  [INFERRED]
  src/lib/supabase/server.ts → src/lib/supabase/proxy.test.ts
- `gotoClosed()` --calls--> `gotoStory()`  [EXTRACTED]
  e2e/storybook-overlays.spec.ts → e2e/storybook-helpers.ts
- `AnteprimaErrore()` --calls--> `isErrorPreviewEnabled()`  [EXTRACTED]
  src/app/(giocatore)/anteprima/503/page.tsx → src/lib/errors/preview.ts

## Import Cycles
- None detected.

## Communities (90 total, 12 thin omitted)

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
Cohesion: 0.18
Nodes (11): dateFormatter, formatPolicyDate(), PRIVACY_CONTROLLER, PRIVACY_POLICY_VERSION, PrivacyPolicyVersion, PrivacySection, PrivacySectionId, metadata (+3 more)

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
Cohesion: 0.21
Nodes (8): useMediaQuery(), AdminSidebar(), adminNav, isNavItemActive(), NavItem, playerPrimaryNav, playerSecondaryNav, useNavDisclosure()

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (28): AnteprimaForbidden(), Guasto(), AnteprimaErrore(), ActionLink(), ErrorBoard(), ErrorBoardProps, ForbiddenContent(), Role (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): Colori, GROUPS, KIND_LABEL, Story, Swatch(), DocPage(), DocSection(), densities (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (25): PAGES, WIDTHS, analyzeWhenIdle(), expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, PAGES (+17 more)

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (8): Phase, PhaseBadge(), PhaseBadgeProps, phases, Default, Fasi, RiduzioneMovimento, Story

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (12): Admin, AdminMobile, columns, Giocatore, GiocatoreMobile, mobile, Standing, standings (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (14): FieldContext, FieldContextValue, FieldControlOwnProps, FieldError(), FieldHint(), FieldMessagesProps, FieldProps, FieldsetProps (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): Badge(), BadgeContent, BadgeProps, badgeVariants, Caricamento, Default, Errore, Pillola (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (21): columns, metadata, stats, DemoGroup, DemoGroupMatch, demoGroups, demoLiveMatches, DemoMatch (+13 more)

### Community 29 - "Community 29"
Cohesion: 0.13
Nodes (23): createLiveBus(), getLiveBus(), globalForLive, LiveListener, at, empty, match, publishGroupStandings() (+15 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): BordoCampo, Caricamento, ConDescrizione, Default, Disabilitato, Errore, Focus, Gruppo (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.57
Nodes (5): loginHref(), signupHref(), signupReturnPath(), withReturn(), SignupFormFromParams()

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (3): metadata, signOut(), AppShell()

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (16): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle() (+8 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (15): Consenso, Iscrizione, Punteggio, SetPunteggio, STATI_ISCRIZIONE, STATI_PARTITA, StatoIscrizione, StatoPartita (+7 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (7): FlipDigits(), FlipDigitsProps, Default, Interattivo, Orario, RiduzioneMovimento, Story

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (11): mergeIds(), Checkbox(), CheckboxProps, Field(), Fieldset(), focusFirstInvalid(), useFieldMessages(), Default (+3 more)

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
Cohesion: 0.27
Nodes (7): Category, CategoryLabel(), CategoryLabelProps, labels, Default, Femminile, Story

### Community 41 - "Community 41"
Cohesion: 0.17
Nodes (10): RadioCard(), RadioCardGroup(), BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (8): MinimalShell(), SkipLink(), mobile, mobile, MovimentoRidotto, PaginaCompleta, Story, Testo200

### Community 43 - "Community 43"
Cohesion: 0.25
Nodes (3): times, usePrefersReducedMotion(), mockMatchMedia()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): ScoreDigits(), ScoreDigitsProps, Classifica, Default, RiduzioneMovimento, Story, Toni, tones

### Community 45 - "Community 45"
Cohesion: 0.39
Nodes (7): clearSignupDraft(), EMPTY_DRAFT, readSignupDraft(), saveSignupDraft(), SignupDraft, storage(), text()

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (23): dbErrorResponse(), forbidden(), notFound(), PostgrestLikeError, isUuid(), ADMIN_GUARD, AdminUser, Handler (+15 more)

### Community 47 - "Community 47"
Cohesion: 0.16
Nodes (5): readTappa(), BodyReader, STATI_TAPPA, GET, POST

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
Cohesion: 0.23
Nodes (11): noContent(), clearPendingVerification(), POST(), sendRecoveryEmail(), createClient(), getSupabaseEnv(), readSupabaseEnv(), SupabaseEnv (+3 more)

### Community 56 - "Community 56"
Cohesion: 0.20
Nodes (7): renderLive(), baseSnapshot, baseSync, testConnection(), TestEventSource, animate, renderAndReorder()

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): Connessione, Live, Offline, Riconnessione, RiduzioneMovimento, Story, Testo200

### Community 58 - "Community 58"
Cohesion: 0.34
Nodes (14): invalid(), jsonError(), malformedBody(), readJsonObject(), limitAuthAttempt(), POST(), POST(), hasRecentRecoverySession() (+6 more)

### Community 59 - "Community 59"
Cohesion: 0.22
Nodes (10): AuthAction, clientIp(), createMemoryRateLimitStore(), createSupabaseRateLimitStore(), getStore(), RateLimitHit, RateLimitStore, Rule (+2 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (11): Default, empty, FieldErrors, filled, Loading, LongText, mobile, Network (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.08
Nodes (25): SUPABASE_DIR, accodaEmail(), EmailAccodata, ErroreCodaEmail, props, EmailTemplateName, EmailTemplateProps, emailTemplates (+17 more)

### Community 63 - "Community 63"
Cohesion: 0.15
Nodes (13): describeError(), EmailMessage, EmailQueueLogger, EmailQueueResult, EmailQueueStore, EmailTransport, processEmailQueue(), QueuedEmail (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.13
Nodes (14): BordoCampo, Caricamento, ConIcona, Default, Dimensioni, Disabilitato, DisabilitatoConMotivo, Errore (+6 more)

### Community 65 - "Community 65"
Cohesion: 0.18
Nodes (15): extractLinks(), getLatestLink(), HTML_ENTITIES, isMailpitAvailable(), mailpit(), MAILPIT_URL, MailpitMessage, MailpitSummary (+7 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (28): ClassificaContent(), columns, metadata, findGroup(), generateMetadata(), GironeContent(), GironePage(), LiveAnnouncer() (+20 more)

### Community 67 - "Community 67"
Cohesion: 0.09
Nodes (21): backoffDelay(), createDeduper(), createLiveConnection(), EventSourceLike, LiveConnectionOptions, LiveStatus, FakeNetwork, setup() (+13 more)

### Community 68 - "Community 68"
Cohesion: 0.21
Nodes (11): Disabilitata, MOLTE, MolteSchede, Predefinito, SEZIONI, Story, Testo200, Tabs() (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.28
Nodes (7): readSignup(), SignupInput, SignupResult, SignupValues, valid, CATEGORIE, readSets()

### Community 70 - "Community 70"
Cohesion: 0.23
Nodes (4): PlayerNav(), navigation, signOut, installMatchMedia()

### Community 72 - "Community 72"
Cohesion: 0.11
Nodes (18): withText200(), Dialog(), DialogActionProps, DialogBody(), DialogClose(), DialogContent(), DialogDescription(), DialogHeader() (+10 more)

### Community 73 - "Community 73"
Cohesion: 0.20
Nodes (6): metadata, ResetLinkInvalid(), metadata, Button(), ButtonProps, buttonVariants

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (10): groupColumns, overallColumns, GroupStandingRow, OverallStandingRow, liveRowAttributes(), ResponsiveTable(), ResponsiveTableColumn, columns (+2 more)

### Community 75 - "Community 75"
Cohesion: 0.29
Nodes (6): initialSignOutState, SignOutState, SignOutAction, SignOutButton(), TopbarHeight(), Topbar()

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (4): FieldErrors, ErrorBody, postJson(), PostOutcome

### Community 79 - "Community 79"
Cohesion: 0.30
Nodes (9): LiveBus, formatSseEvent(), formatSsePing(), formatSseResync(), parseSeq(), createLiveStream(), SSE_HEADERS, GET() (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.24
Nodes (4): PrivacyIndex(), sections, tops, useActiveSection()

### Community 81 - "Community 81"
Cohesion: 0.20
Nodes (5): metadata, SignupForm(), SignupFormInner(), useIsClient(), useOnlineStatus()

### Community 82 - "Community 82"
Cohesion: 0.27
Nodes (9): ApiErrorBody, Categoria, boardName(), categoryText, SignupBoardPreview(), SignupFormProps, Status, SignupOutcome (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.43
Nodes (5): consent(), fillValid(), password(), { replace, refresh }, textbox()

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (3): Phase, PrivacySampleRow(), SAMPLE_ROW

### Community 85 - "Community 85"
Cohesion: 0.07
Nodes (42): EmailVerifyState(), isConfirmed(), metadata, resolveState(), EmailVerifyOutcome, EmailVerifyStatus, OUTCOMES, readOutcome() (+34 more)

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (6): AppFooter(), privacyHref(), safeReturnPath(), ReturnLink(), ReturnLinkFromParams(), ReturnLinkProps

### Community 87 - "Community 87"
Cohesion: 0.33
Nodes (8): encodePending(), MAX_AGE_SECONDS, PendingVerification, rememberPendingVerification(), POST(), retryAfterSeconds(), tooSoon(), now()

### Community 88 - "Community 88"
Cohesion: 0.25
Nodes (4): gotrue, { jar }, pendingCookie(), T0

## Knowledge Gaps
- **501 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+496 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `Community 87` to `Community 66`, `Community 12`, `Community 79`, `Community 85`, `Community 58`, `Community 59`, `Community 29`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 73` to `Community 64`, `Community 33`, `Community 35`, `Community 36`, `Community 72`, `Community 10`, `Community 12`, `Community 82`, `Community 85`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `expectNoA11yViolations()` connect `Community 17` to `Community 65`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _501 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._