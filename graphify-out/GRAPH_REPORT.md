# Graph Report - 4775bc2d-e2f3-42bf-9ab9-58eb8204ae0b  (2026-10-27)

## Corpus Check
- 348 files · ~91,332 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1529 nodes · 3026 edges · 108 communities (92 shown, 16 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d6fa85a`
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
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]

## God Nodes (most connected - your core abstractions)
1. `readSupabaseEnv()` - 26 edges
2. `BodyReader` - 25 edges
3. `jsonError()` - 23 edges
4. `invalid()` - 21 edges
5. `readJsonObject()` - 18 edges
6. `formatServerTime()` - 18 edges
7. `expectNoA11yViolations()` - 17 edges
8. `scripts` - 17 edges
9. `Button()` - 17 edges
10. `malformedBody()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `DraftList()` --calls--> `formatServerTime()`  [EXTRACTED]
  src/components/auth/session-expired-view.tsx → src/lib/time/server-time.ts
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

## Communities (108 total, 16 thin omitted)

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
Cohesion: 0.17
Nodes (8): nextConfig, enforceHttps(), isApiPath(), isHttpsEnforced(), config, RouteHandler, serve(), proxy()

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (12): withText200(), ConAzione, Demo(), Story, Testo200, Vuoto, Annulla(), Toaster() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.21
Nodes (8): useMediaQuery(), AdminSidebar(), adminNav, isNavItemActive(), NavItem, playerPrimaryNav, playerSecondaryNav, useNavDisclosure()

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (11): ActionLink(), ErrorBoard(), ErrorBoardProps, ForbiddenContent(), Role, roleLabels, NotFoundContent(), ScoreboardRow (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (28): Colori, GROUPS, KIND_LABEL, Story, Swatch(), DocPage(), DocSection(), densities (+20 more)

### Community 16 - "Community 16"
Cohesion: 0.40
Nodes (4): desktop1440, mobile390, PORT, STORYBOOK_PORT

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (8): analyzeWhenIdle(), expectNoA11yViolations(), makeAxeBuilder(), test, WCAG_22_AA_TAGS, WIDTHS, StoryIndex, VIEWPORTS

### Community 18 - "Community 18"
Cohesion: 0.40
Nodes (4): Default, Fasi, RiduzioneMovimento, Story

### Community 21 - "Community 21"
Cohesion: 0.13
Nodes (12): Admin, AdminMobile, columns, Giocatore, GiocatoreMobile, mobile, Standing, standings (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (19): Field(), FieldContext, FieldContextValue, FieldControlOwnProps, FieldError(), FieldHint(), FieldMessagesProps, FieldProps (+11 more)

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (5): auth, redirectMock, signInWithPassword, signOutMock, valid

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (12): Badge(), BadgeContent, BadgeProps, badgeVariants, Caricamento, Default, Errore, Pillola (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (22): columns, metadata, stats, DemoGroup, DemoGroupMatch, demoGroups, demoLiveMatches, DemoMatch (+14 more)

### Community 29 - "Community 29"
Cohesion: 0.15
Nodes (19): createLiveBus(), getLiveBus(), globalForLive, LiveListener, at, empty, match, publishGroupStandings() (+11 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (11): BordoCampo, Caricamento, ConDescrizione, Default, Disabilitato, Errore, Focus, Gruppo (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.57
Nodes (5): loginHref(), signupHref(), signupReturnPath(), withReturn(), SignupFormFromParams()

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (6): metadata, signOut(), AppShell(), SignOutAction, TopbarHeight(), Topbar()

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (15): AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle() (+7 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (20): SignupInput, SignupResult, SignupValues, valid, Categoria, CATEGORIE, Consenso, Iscrizione (+12 more)

### Community 35 - "Community 35"
Cohesion: 0.16
Nodes (7): FlipDigits(), FlipDigitsProps, Default, Interattivo, Orario, RiduzioneMovimento, Story

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (16): Message, mergeIds(), Checkbox(), CheckboxProps, FieldSize, focusFirstInvalid(), useFieldControl(), controlVariants (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.20
Nodes (9): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Obbligatorio, Story (+1 more)

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Story, Testo200

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (8): times, Default, RiduzioneMovimento, Spessa, Story, Tape(), TapeProps, mockMatchMedia()

### Community 40 - "Community 40"
Cohesion: 0.18
Nodes (11): Category, CategoryLabel(), CategoryLabelProps, labels, Default, Femminile, Story, Phase (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (8): BordoCampo, Caricamento, Default, Disabilitato, Errore, Focus, Story, Testo200

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (3): MinimalShell(), SkipLink(), mobile

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (6): liveRowAttributes(), Phase, PrivacySampleRow(), SAMPLE_ROW, usePrefersReducedMotion(), useReducedMotion()

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): ScoreDigits(), ScoreDigitsProps, Classifica, Default, RiduzioneMovimento, Story, Toni, tones

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (11): clearSignupDraft(), EMPTY_DRAFT, readSignupDraft(), saveSignupDraft(), SignupDraft, storage(), text(), SignupFormInner() (+3 more)

### Community 46 - "Community 46"
Cohesion: 0.10
Nodes (28): dbErrorResponse(), forbidden(), notFound(), PostgrestLikeError, readTappa(), isUuid(), ADMIN_GUARD, AdminUser (+20 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (22): ETICHETTE_EVENTO_REGISTRO, TIPI_EVENTO_REGISTRO, TipoEventoRegistro, ErroreRegistro, formatOraRegistro(), NuovoEventoRegistro, registraEvento(), MIGRATION (+14 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (15): dependencies, @base-ui/react, class-variance-authority, cn, lucide-react, next, react, react-dom (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (20): LoginFormFromParams(), SessionExpiredFromParams(), describeReturnPath(), loginHref(), LoginReason, matches(), NAMED_PAGES, PUBLIC_PATHS (+12 more)

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
Cohesion: 0.19
Nodes (15): noContent(), getCurrentUser(), rememberPendingVerification(), POST(), sendRecoveryEmail(), POST(), retryAfterSeconds(), tooSoon() (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.19
Nodes (9): renderLive(), LiveProvider(), baseSnapshot, baseSync, testConnection(), TestEventSource, LiveEvent, animate (+1 more)

### Community 57 - "Community 57"
Cohesion: 0.25
Nodes (7): Connessione, Live, Offline, Riconnessione, RiduzioneMovimento, Story, Testo200

### Community 58 - "Community 58"
Cohesion: 0.32
Nodes (15): invalid(), jsonError(), malformedBody(), readJsonObject(), limitAuthAttempt(), readSignup(), POST(), POST() (+7 more)

### Community 59 - "Community 59"
Cohesion: 0.15
Nodes (14): isAdminPath(), signIn(), rateLimitedLoginMessage(), AuthAction, AuthAttemptCheck, checkAuthAttempt(), clientIp(), createMemoryRateLimitStore() (+6 more)

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (11): Default, empty, FieldErrors, filled, Loading, LongText, mobile, Network (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.10
Nodes (22): SUPABASE_DIR, accodaEmail(), EmailAccodata, ErroreCodaEmail, props, EmailTemplateName, EmailTemplateProps, emailTemplates (+14 more)

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
Cohesion: 0.15
Nodes (19): findGroup(), generateMetadata(), GironePage(), LiveAnnouncer(), LiveBar(), LiveBarConnected(), LiveLoading(), useLive() (+11 more)

### Community 67 - "Community 67"
Cohesion: 0.11
Nodes (15): backoffDelay(), createDeduper(), createLiveConnection(), EventSourceLike, LiveConnectionOptions, FakeNetwork, setup(), Action (+7 more)

### Community 68 - "Community 68"
Cohesion: 0.21
Nodes (11): Disabilitata, MOLTE, MolteSchede, Predefinito, SEZIONI, Story, Testo200, Tabs() (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.15
Nodes (12): metadata, LoginForm(), LoginFormProps, SignInAction, SignOutFormAction, FORM_ERRORS, LoginFormView(), LoginFormViewProps (+4 more)

### Community 70 - "Community 70"
Cohesion: 0.23
Nodes (4): PlayerNav(), navigation, signOut, installMatchMedia()

### Community 72 - "Community 72"
Cohesion: 0.12
Nodes (18): Dialog(), DialogAction(), DialogBody(), DialogClose(), DialogContent(), DialogDescription(), DialogFooter(), DialogHeader() (+10 more)

### Community 73 - "Community 73"
Cohesion: 0.20
Nodes (6): metadata, ResetLinkInvalid(), metadata, Button(), ButtonProps, buttonVariants

### Community 74 - "Community 74"
Cohesion: 0.13
Nodes (12): ClassificaContent(), columns, metadata, GironeContent(), LiveContent(), readLiveSync(), ResponsiveTable(), ResponsiveTableColumn (+4 more)

### Community 75 - "Community 75"
Cohesion: 0.52
Nodes (3): initialSignOutState, SignOutState, SignOutButton()

### Community 76 - "Community 76"
Cohesion: 0.33
Nodes (4): FieldErrors, ErrorBody, postJson(), PostOutcome

### Community 79 - "Community 79"
Cohesion: 0.23
Nodes (12): LiveBus, formatSseEvent(), formatSsePing(), formatSseResync(), parseSeq(), createLiveStream(), SSE_HEADERS, GET() (+4 more)

### Community 80 - "Community 80"
Cohesion: 0.24
Nodes (4): PrivacyIndex(), sections, tops, useActiveSection()

### Community 81 - "Community 81"
Cohesion: 0.24
Nodes (14): clearDrafts(), draftable(), DraftValues, FormControl, isDraft(), listDrafts(), readDraft(), removeDraft() (+6 more)

### Community 82 - "Community 82"
Cohesion: 0.21
Nodes (9): ApiErrorBody, metadata, boardName(), categoryText, SignupBoardPreview(), SignupForm(), SignupFormProps, SignupOutcome (+1 more)

### Community 83 - "Community 83"
Cohesion: 0.43
Nodes (5): consent(), fillValid(), password(), { replace, refresh }, textbox()

### Community 84 - "Community 84"
Cohesion: 0.22
Nodes (8): REGISTRATION_STEPS, formatExpiry(), EmailPreview(), EmailVerifyScreen(), T0, RegistrationSteps(), ResendPanel(), confermaEmailCopy

### Community 85 - "Community 85"
Cohesion: 0.21
Nodes (12): EmailVerifyState(), isConfirmed(), metadata, resolveState(), readOutcome(), formatCountdown(), formatValidity(), linkExpiresAt() (+4 more)

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (6): AppFooter(), privacyHref(), safeReturnPath(), ReturnLink(), ReturnLinkFromParams(), ReturnLinkProps

### Community 87 - "Community 87"
Cohesion: 0.19
Nodes (11): EmailVerifyOutcome, EmailVerifyStatus, OUTCOMES, ResendError, ResendResponse, clearPendingVerification(), MAX_AGE_SECONDS, PendingVerification (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.22
Nodes (5): gotrue, { jar }, pendingCookie(), T0, encodePending()

### Community 90 - "Community 90"
Cohesion: 0.23
Nodes (9): LiveStatus, announcementFor(), statusAnnouncement(), match, meta, formatLiveTime(), LiveBarProps, Time() (+1 more)

### Community 91 - "Community 91"
Cohesion: 0.16
Nodes (10): geistMono, geistSans, metadata, Providers(), figtree, fontVariables, mono, outfit (+2 more)

### Community 92 - "Community 92"
Cohesion: 0.14
Nodes (13): AccessoSospeso, CredenzialiErrate, Default, FieldErrors, Loading, NonDisponibile, PermissionDenied, retryAt (+5 more)

### Community 93 - "Community 93"
Cohesion: 0.26
Nodes (7): StoryIndex, VIEWPORTS, gotoStory(), storyScope(), waitForAnimations(), LIVE_BAR_STORIES, gotoClosed()

### Community 94 - "Community 94"
Cohesion: 0.26
Nodes (9): register(), TappaAnnullata(), formatServerTime(), getProcessTimeZone(), getServerTimeParts(), getUtcOffsetMinutes(), partsFormatter, ServerTimeParts (+1 more)

### Community 96 - "Community 96"
Cohesion: 0.24
Nodes (8): DraftList(), SessionExpiredView(), SessionExpiredViewProps, ConBozze, Default, Story, Text200, Draft

### Community 97 - "Community 97"
Cohesion: 0.20
Nodes (9): Default, Loading, LongText, PermissionDenied, ReinvioBloccato, SessionExpired, SessionExpiredSenzaEmail, Story (+1 more)

### Community 98 - "Community 98"
Cohesion: 0.36
Nodes (4): AnteprimaForbidden(), Guasto(), AnteprimaErrore(), isErrorPreviewEnabled()

### Community 99 - "Community 99"
Cohesion: 0.28
Nodes (5): params, initialSignInState, SignInField, SignInState, SignInStatus

### Community 101 - "Community 101"
Cohesion: 0.36
Nodes (4): consent(), field(), fill(), password()

### Community 103 - "Community 103"
Cohesion: 0.33
Nodes (5): mobile, MovimentoRidotto, PaginaCompleta, Story, Testo200

### Community 105 - "Community 105"
Cohesion: 0.40
Nodes (4): Admin, Default, Story, Testo200

### Community 106 - "Community 106"
Cohesion: 0.40
Nodes (4): Caricamento, Default, Story, Testo200

### Community 107 - "Community 107"
Cohesion: 0.50
Nodes (3): Default, Story, Testo200

## Knowledge Gaps
- **535 isolated node(s):** `plugins`, `tailwindStylesheet`, `config`, `VIEWPORTS`, `preview` (+530 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `now()` connect `Community 87` to `Community 36`, `Community 69`, `Community 74`, `Community 79`, `Community 81`, `Community 85`, `Community 55`, `Community 58`, `Community 59`, `Community 29`, `Community 94`, `Community 95`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `Button()` connect `Community 73` to `Community 64`, `Community 33`, `Community 35`, `Community 36`, `Community 69`, `Community 72`, `Community 10`, `Community 12`, `Community 45`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `expectNoA11yViolations()` connect `Community 17` to `Community 65`, `Community 100`, `Community 101`, `Community 102`, `Community 104`, `Community 93`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `plugins`, `tailwindStylesheet`, `config` to the rest of the system?**
  _535 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._