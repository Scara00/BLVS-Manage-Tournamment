# Risultati · prova di carico live

## 2026-10-28 · istanza locale, 300 client

- **Ambiente**: `next start` (build di produzione, commit di questo branch) su
  Apple M5 Pro (18 core, 24 GB), Node 24.15, `LIVE_DEMO_PUBLISH=true`, nessun
  env Supabase (bus a istanza singola, relay spento). k6 v2.3.0 + xk6-sse
  v0.2.0 sullo stesso host. **Non c'è uno staging**: la prova su Vercel con il
  relay Realtime resta da fare (task di follow-up).
- **Carico**: 300 client SSE collegati in 30 s, poi 1 punteggio ogni 2 s per
  2 minuti (61 salvataggi).
- **Riepilogo completo**: `live-p95.json` (output di `handleSummary`).

| Metrica                              | Valore                                        | Soglia      | Esito |
| ------------------------------------ | --------------------------------------------- | ----------- | ----- |
| `live_latenza_ms` p95                | **15 ms** (min 3, mediana 11, p99 16, max 17) | < 5000 ms   | ✅    |
| `live_latenza_da_salvataggio_ms` p95 | 10 ms                                         | informativa | —     |
| Eventi ricevuti                      | 18 300 = 300 client × 61 punteggi             | —           | —     |
| Eventi persi                         | 0                                             | —           | —     |
| `live_consegna_completa`             | 300/300 client                                | > 99%       | ✅    |
| `live_salvataggio_ok`                | 61/61 (HTTP 201)                              | > 99%       | ✅    |
| Stream aperti (HTTP 200)             | 300/300                                       | —           | ✅    |
