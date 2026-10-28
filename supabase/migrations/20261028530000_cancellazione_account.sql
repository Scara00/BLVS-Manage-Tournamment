-- BLVS-53 · Cancellazione dell'account (R-80).
--
-- Il giocatore cancella il proprio account e i suoi dati personali spariscono:
-- nome e cognome diventano «Giocatore anonimo», l'email si cancella, l'utente
-- Auth (hash della password, identità, sessioni) e i consensi si eliminano.
-- I risultati restano: iscrizioni, gironi, partite e punteggi puntano ancora
-- allo stesso `utenti.id`, che da ora è un identificativo anonimo. Così la
-- classifica generale e quelle di tappa non cambiano (stesse posizioni, stessi
-- punti), cambia solo il nome mostrato.
--
-- Il segnaposto è scritto nel nome stesso (nome «Giocatore», cognome
-- «anonimo»): ogni lettore di nomi (RPC pubbliche, registro, admin) mostra
-- «Giocatore anonimo» senza modifiche. TS: `GIOCATORE_ANONIMO` in
-- src/lib/cancellazione/anonimo.ts (un test PGlite li confronta).

-- ---------------------------------------------------------------------------
-- utenti: l'email si può cancellare, ma solo su un account anonimizzato
-- ---------------------------------------------------------------------------

alter table public.utenti add column anonimizzato_il timestamptz;

alter table public.utenti alter column email drop not null;
alter table public.utenti add constraint utenti_email_presente
  check (email is not null or anonimizzato_il is not null);

-- L'utente applicativo non dipende più dalla riga Auth: un account cancellato
-- perde la riga in auth.users ma la sua riga anonima resta, con i risultati.
alter table public.utenti drop constraint utenti_id_fkey;

-- Per tutti gli altri resta la cascata di prima (pulizia dei test, utenti
-- eliminati dalla console Auth).
create function public.elimina_utente_da_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.utenti
  where id = old.id and anonimizzato_il is null;
  return old;
end;
$$;

create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function public.elimina_utente_da_auth();

-- Solo `cancella_account()` (con la GUC transazionale
-- `blvs.cancellazione_account`) anonimizza: nessun client può segnare da sé
-- `anonimizzato_il` né cambiare la propria email o il ruolo.
create or replace function public.proteggi_campi_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attore uuid := (select auth.uid());
begin
  if attore is null
     or current_setting('blvs.cancellazione_account', true) = 'on' then
    return new;
  end if;

  if new.anonimizzato_il is distinct from old.anonimizzato_il then
    raise exception 'Un account si cancella solo dalle impostazioni'
      using errcode = 'insufficient_privilege';
  end if;

  if old.anonimizzato_il is not null then
    raise exception 'Account cancellato: i dati non si modificano più'
      using errcode = 'insufficient_privilege', hint = 'account_cancellato';
  end if;

  if (new.ruolo, new.email) is distinct from (old.ruolo, old.email)
     and not public.is_admin() then
    raise exception 'Solo un admin può cambiare ruolo o email'
      using errcode = 'insufficient_privilege';
  end if;

  if attore = old.id and old.ruolo = 'admin' and new.ruolo <> 'admin' then
    raise exception 'Un admin non può togliersi il ruolo'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Il registro automatico copia la riga intera (email compresa): la
-- cancellazione non deve lasciarvi i dati che sta cancellando.
drop trigger utenti_registro on public.utenti;
create trigger utenti_registro
after update of ruolo, categoria, email on public.utenti
for each row
when (new.anonimizzato_il is null)
execute function public.scrivi_registro();

-- ---------------------------------------------------------------------------
-- consensi: in sola aggiunta, tranne per la cancellazione dell'account
-- ---------------------------------------------------------------------------

create or replace function public.blocca_modifica_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and tg_table_name = 'consensi' then
    -- Diritto all'oblio: cascata dall'utente eliminato, o `cancella_account()`.
    if current_setting('blvs.cancellazione_account', true) = 'on'
       or not exists (
         select 1 from public.utenti
         where id = (to_jsonb(old) ->> 'utente_id')::uuid
       ) then
      return old;
    end if;
  end if;
  raise exception 'La tabella % è in sola aggiunta', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

-- ---------------------------------------------------------------------------
-- Un account cancellato non si iscrive più a nessuna tappa (neanche da admin)
-- ---------------------------------------------------------------------------

create function public.blocca_iscrizione_anonimo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.utenti
    where id = new.utente_id and anonimizzato_il is not null
  ) then
    raise exception 'Giocatore non trovato'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;
  return new;
end;
$$;

create trigger iscrizioni_utente_anonimo
before insert on public.iscrizioni
for each row execute function public.blocca_iscrizione_anonimo();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Segnaposto del nome: «Giocatore anonimo».
create function public.nome_anonimo()
returns table (nome text, cognome text)
language sql
immutable
set search_path = ''
as $$
  select 'Giocatore'::text, 'anonimo'::text;
$$;

-- Cancella l'account di chi è connesso (mai di un altro: niente parametri).
-- In una transazione:
-- 1. ritira le iscrizioni attive (in_attesa/confermata) delle tappe che non
--    sono ancora iniziate, come `admin_rimuovi_iscrizione` (il posto torna
--    libero, il giocatore esce dal girone);
-- 2. anonimizza `utenti` (nome, cognome, email; ruolo giocatore);
-- 3. elimina i consensi e la riga di auth.users (hash, identità, sessioni).
-- Iscrizioni, gironi, partite e punteggi delle tappe giocate restano.
--
-- Errori: 42501 senza sessione; 23514 `gia_cancellato`; 23514
-- `ultimo_admin` se è l'unico admin rimasto.
-- Ritorna `{tappe: [una tappa in classifica per stagione], ritirate: N}`:
-- il server ripubblica in live la classifica generale di quelle stagioni.
create function public.cancella_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_riga public.utenti;
  v_ritirate int;
  v_tappe jsonb;
begin
  if v_utente is null then
    raise exception 'Accedi per cancellare il tuo account'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_riga from public.utenti where id = v_utente for update;
  if not found then
    raise exception 'Account non trovato'
      using errcode = 'insufficient_privilege';
  end if;
  if v_riga.anonimizzato_il is not null then
    raise exception 'L''account è già stato cancellato'
      using errcode = 'check_violation', hint = 'gia_cancellato';
  end if;
  if v_riga.ruolo = 'admin' and not exists (
    select 1 from public.utenti
    where ruolo = 'admin' and id <> v_utente and anonimizzato_il is null
  ) then
    raise exception 'Sei l''unico admin: nomina un altro admin prima di cancellare l''account'
      using errcode = 'check_violation', hint = 'ultimo_admin';
  end if;

  perform set_config('blvs.cancellazione_account', 'on', true);

  -- 1. Iscrizioni attive delle tappe non ancora iniziate.
  with attive as (
    select i.id, i.tabellone_id
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = v_utente
      and i.stato in ('in_attesa', 'confermata')
      and public.tappa_iscritti_modificabili(t.stato)
    for update of i
  ),
  fuori as (
    delete from public.girone_iscrizioni gi
    using attive a
    where gi.iscrizione_id = a.id
    returning a.tabellone_id
  ),
  versione as (
    update public.tabelloni tb
    set versione_gironi = tb.versione_gironi + 1
    where tb.id in (select tabellone_id from fuori)
  )
  update public.iscrizioni i
  set stato = 'ritirata'
  from attive a
  where i.id = a.id;
  get diagnostics v_ritirate = row_count;

  -- Una tappa in classifica del giocatore per stagione: ripubblicarla in
  -- live aggiorna la classifica generale di quella stagione.
  select coalesce(jsonb_agg(x.tappa_id), '[]'::jsonb) into v_tappe
  from (
    select distinct on (t.stagione) i.tappa_id
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = v_utente and public.tappa_in_classifica(t.stato)
    order by t.stagione, t.data_inizio desc
  ) x;

  -- 2. Anonimizzazione.
  update public.utenti u
  set nome = n.nome,
      cognome = n.cognome,
      email = null,
      ruolo = 'giocatore',
      anonimizzato_il = now()
  from public.nome_anonimo() n
  where u.id = v_utente;

  -- 3. Consensi e utente Auth (con hash, identità e sessioni).
  delete from public.consensi where utente_id = v_utente;
  delete from auth.users where id = v_utente;

  return jsonb_build_object('tappe', v_tappe, 'ritirate', v_ritirate);
end;
$$;

revoke all on function public.cancella_account() from public, anon;
grant execute on function public.cancella_account() to authenticated;
