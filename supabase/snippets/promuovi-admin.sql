-- Primo admin del progetto remoto (database partito vuoto, senza seed.sql).
-- 1. Registra l'account da /registrati e conferma l'email.
-- 2. Esegui questo script nel SQL editor della Dashboard (gira senza JWT, quindi
--    il trigger proteggi_campi_utente lo lascia passare), con l'email giusta.
-- Gli admin successivi li promuove un admin con PATCH /api/admin/utenti/:id/ruolo.
update public.utenti
set ruolo = 'admin'
where email = 'nome@dominio.it'   -- ← l'email dell'admin (citext: maiuscole indifferenti)
returning id, email, ruolo;
