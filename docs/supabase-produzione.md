# Collegare il progetto Supabase di produzione

Un solo progetto Supabase, solo produzione. App su https://blvs-manage-tournamment.vercel.app.
Database vuoto (niente `seed.sql`) con un admin reale. Niente SMTP personalizzato per ora.

Serve la Supabase CLI collegata all'account che possiede il progetto
(`supabase login`, poi `supabase projects list` deve mostrarlo).

## 1. Migrazioni

```bash
supabase link --project-ref <ref>          # chiede la password del database
supabase db push                           # applica supabase/migrations/*, NON il seed
```

Se `db push` fallisce su `pg_cron`, `pg_net` o `vault`, abilitale in Dashboard →
Database → Extensions e rilancia. Le migrazioni non toccano mai `seed.sql`: non
lanciare `supabase db reset --linked`, cancellerebbe il database di produzione.

## 2. Auth (Dashboard → Authentication)

La Dashboard non legge `supabase/config.toml`. Non usare `supabase config push`
senza prima aver cambiato `site_url`, perché porterebbe in produzione
`http://127.0.0.1:3000`. Imposta a mano:

| Dove                                      | Valore                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL Configuration → Site URL              | `https://blvs-manage-tournamment.vercel.app`                                                                                                                                          |
| URL Configuration → Redirect URLs         | `https://blvs-manage-tournamment.vercel.app/**` (e `https://*-<team>.vercel.app/**` se usi le preview)                                                                                |
| Sign In / Providers → Email               | Confirm email **on**, Secure email change **on** (`double_confirm_changes`)                                                                                                           |
| Email OTP expiration                      | `3600` secondi                                                                                                                                                                        |
| Rate limits → intervallo minimo tra email | `60` secondi                                                                                                                                                                          |
| Password                                  | lunghezza minima `10`, requisiti «letters and digits»                                                                                                                                 |
| Emails → Templates                        | Confirm signup ← `supabase/templates/conferma-email.html`, Change email ← `conferma-nuova-email.html`, Reset password ← `reimposta-password.html` (anche l'oggetto, da `config.toml`) |

I template usano `{{ .SiteURL }}`: con il Site URL giusto i link portano a
`/registrati/conferma-email/verifica` e `/reimposta-password` dell'app.

**SMTP**: senza SMTP personalizzato Supabase invia solo agli indirizzi del team
del progetto e con un limite di poche email l'ora. Le registrazioni dei
giocatori reali non ricevono la conferma finché non si configura un provider
(Authentication → SMTP; porta 465). Vedi il task di follow-up.

## 3. Variabili d'ambiente

Dashboard → Project Settings → API keys.

`.env.local` (locale) e Vercel → Settings → Environment Variables (Production):

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…        # solo server, mai NEXT_PUBLIC_
ENFORCE_HTTPS=true                     # solo su Vercel
CRON_SECRET=<stringa casuale lunga>    # solo su Vercel: protegge /api/cron/*
```

`CRON_SECRET` serve al job che chiude le iscrizioni alla scadenza
(`vercel.json` → `/api/cron/chiudi-iscrizioni`); senza, la route risponde 503
e le iscrizioni scadute si chiudono solo quando un admin apre le pagine delle
tappe (la policy RLS impedisce comunque di iscriversi dopo la scadenza).

Ridistribuisci dopo averle impostate: `ENFORCE_HTTPS` è letta al build.

Con queste variabili l'app protegge le pagine (Proxy → `/accesso`) e legge i
dati reali: `/tappe` da `public.tappe`, la dashboard `/admin` da tappe,
iscrizioni e utenti. Senza variabili (CI, e2e) restano i dati demo.

## 4. Primo admin

1. Registrati da `/registrati` con l'email dell'admin e apri il link di conferma.
2. SQL editor: esegui `supabase/snippets/promuovi-admin.sql` con quell'email.
3. Esci e rientra: ora `/admin` mostra la dashboard.

## 5. Coda email (Edge Function `send-emails`)

Solo quando c'è un SMTP (vedi sopra). Fino ad allora le email accodate in
`public.coda_email` restano lì, e la funzione senza `EMAIL_DELIVERY=live`
non invia a indirizzi reali.

```bash
supabase secrets set EMAIL_DELIVERY=live EMAIL_WORKER_SECRET=<segreto> \
  SMTP_HOST=<host> SMTP_PORT=465 SMTP_USER=<utente> SMTP_PASS=<password> \
  EMAIL_FROM="BLVS <noreply@dominio>"
supabase functions deploy send-emails --no-verify-jwt
```

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-emails', 'email_worker_url');
select vault.create_secret('<segreto>', 'email_worker_secret');
```

## 6. Verifica

- `/` senza sessione → `/accesso?da=%2F`.
- Registrazione → email di conferma → link → `/registrati/conferma-email?esito=confermata`.
- Accesso, «Esci», «Password dimenticata».
- `/tappe` vuota mostra «Nessuna tappa in calendario per ora.»
- Un giocatore su `/admin` riceve 403; l'admin vede i contatori.
