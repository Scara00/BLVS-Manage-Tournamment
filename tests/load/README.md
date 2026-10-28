# Prova di carico del canale live (BLVS-56, R-68)

`live-p95.js` collega **300 client** a `GET /api/live/stream` (SSE) e salva un
punteggio ogni 2 s per 2 minuti. Ogni client misura il tempo tra l'invio del
salvataggio e la ricezione dell'evento `score`.

Soglie, che fanno fallire la prova se non rispettate:

| Metrica                  | Soglia       | Significato                                             |
| ------------------------ | ------------ | ------------------------------------------------------- |
| `live_latenza_ms`        | `p(95)<5000` | salvataggio → ricezione sul client, p95 sotto 5 s       |
| `live_consegna_completa` | `rate>0.99`  | ogni client riceve ogni punteggio, senza buchi (`k6.n`) |
| `live_salvataggio_ok`    | `rate>0.99`  | il salvataggio risponde 201                             |

`live_latenza_da_salvataggio_ms` (da `savedAt` del server alla ricezione) è
solo informativa.

## Cosa misura, e cosa no

Lo scrittore usa `POST /api/live/publish`, aperto solo con
`LIVE_DEMO_PUBLISH=true` (scelta del cliente: misurare la diffusione, non la
scrittura su database). L'evento passa dallo stesso `getLiveBus().publish`
dei salvataggi reali (`publishScore`), dal relay Supabase Realtime tra
istanze, quando è configurato, e dallo stesso stream SSE. Restano fuori la
transazione `salva_punteggio` e il ricalcolo delle classifiche.

Lo scrittore e i client girano sullo stesso host k6, quindi la latenza usa un
solo orologio.

## Eseguirla

Serve k6 ≥ 1.0. k6 2.x scarica da solo l'estensione SSE (`k6/x/sse`,
[xk6-sse](https://github.com/phymbert/xk6-sse)) alla prima esecuzione. Con k6
più vecchi: `xk6 build --with github.com/phymbert/xk6-sse`.

```sh
# Server: build di produzione con il publish di prova aperto
npm run build
LIVE_DEMO_PUBLISH=true npx next start --port 3756

# In un altro terminale
k6 run -e BASE_URL=http://localhost:3756 tests/load/live-p95.js
# oppure: npm run load:live -- -e BASE_URL=…
```

Variabili: `BASE_URL`, `ASCOLTATORI` (300), `RAMPA_S` (30, tempo per
collegare i client), `DURATA_S` (120), `INTERVALLO_S` (2), `RISULTATI`
(percorso del riepilogo JSON, predefinito
`tests/load/risultati/live-p95.json`).

**Su più istanze** (Vercel): servono `SUPABASE_SECRET_KEY` e
`NEXT_PUBLIC_SUPABASE_URL` sul deploy, così il bus usa il relay Realtime
(`src/lib/live/relay.ts`). Senza relay, un salvataggio raggiunge solo i client
della stessa istanza e `live_consegna_completa` fallisce.

Non esiste ancora un ambiente di staging (c'è solo la produzione): i risultati
allegati vengono da un'istanza locale. Vedi `risultati/README.md`.
