-- BLVS-53 · Cancellazione dell'account (R-80), sopra BLVS-50 (R-79).
--
-- BLVS-50 (`20261027460000_giocatore_anonimo.sql`) ha già il segno
-- `utenti.anonimizzato_il`, `anonimizza_utente()`, il segnaposto
-- `nome_anonimo()` («Giocatore anonimo») e l'anonimizzazione quando si
-- elimina l'utente Auth. Qui la cancellazione passa su w-elimina-account:
--   - l'email si cancella (null) invece di diventare un indirizzo fittizio;
--   - un account cancellato non è più admin e non si iscrive più a nessuna
--     tappa, neanche da admin;
--   - chi esce dai gironi di una tappa non iniziata alza `versione_gironi`,
--     come ogni altra modifica dei gironi;
--   - `cancella_account()` elimina anche l'utente Auth (hash della password,
--     identità, sessioni) nella stessa transazione e ritorna le tappe da
--     ripubblicare in live.
-- Le regole restano quelle di BLVS-50: un admin non si cancella da qui
-- (`account_admin`), un giocatore con una tappa in corso nemmeno
-- (`tappa_in_corso`). I risultati restano sempre: iscrizioni, gironi, partite
-- e punteggi puntano ancora allo stesso `utenti.id`, anche quando l'utente
-- Auth si elimina dalla dashboard. TS: `GIOCATORE_ANONIMO` in
-- src/lib/cancellazione/anonimo.ts (un test PGlite li confronta).

-- ---------------------------------------------------------------------------
-- utenti: l'email si può cancellare, ma solo su un account anonimizzato
-- ---------------------------------------------------------------------------

alter table public.utenti alter column email drop not null;
alter table public.utenti add constraint utenti_email_presente
  check (email is not null or anonimizzato_il is not null);

-- ---------------------------------------------------------------------------
-- Anonimizzazione
-- ---------------------------------------------------------------------------

/*
 * Come in BLVS-50, più: email cancellata, ruolo giocatore e versione dei
 * gironi alzata per i tabelloni da cui il giocatore esce. Idempotente:
 * false quando l'account non esiste o è già anonimo.
 */
create or replace function public.anonimizza_utente(p_utente uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trovato boolean;
begin
  perform set_config('blvs.anonimizzazione', 'on', true);

  -- Iscrizioni attive delle tappe non ancora iniziate, ritirate come in
  -- `admin_rimuovi_iscrizione()`: il posto torna libero, il giocatore esce
  -- dal girone.
  with attive as (
    select i.id, i.tabellone_id
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = p_utente
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

  delete from public.consensi where utente_id = p_utente;

  update public.utenti u
  set nome = a.nome,
      cognome = a.cognome,
      email = null,
      ruolo = 'giocatore',
      anonimizzato_il = now()
  from public.nome_anonimo() a
  where u.id = p_utente and u.anonimizzato_il is null;
  v_trovato := found;

  if v_trovato then
    insert into public.registro (attore_id, azione, entita, entita_id, dati)
    values (
      (select auth.uid()), 'anonimizzazione', 'utenti', p_utente::text,
      jsonb_build_object('anonimizzato', true)
    );
  end if;

  perform set_config('blvs.anonimizzazione', 'off', true);
  return v_trovato;
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

-- Cancella l'account di chi è connesso (mai di un altro: niente parametri).
-- In una transazione:
-- 1. `anonimizza_utente()`: ritira le iscrizioni delle tappe non iniziate,
--    cancella nome, cognome, email e consensi;
-- 2. elimina la riga di auth.users (hash, identità, sessioni): il trigger
--    `on_auth_user_deleted` trova l'account già anonimo e non fa altro.
-- Iscrizioni, gironi, partite e punteggi delle tappe giocate restano.
--
-- Errori: 42501 senza sessione; 23514 con hint `gia_cancellato`,
-- `account_admin` (un account dell'organizzazione non si cancella da qui) o
-- `tappa_in_corso` (un'iscrizione attiva in una tappa che si sta giocando:
-- in corso, o iscrizioni chiuse con una fase già avviata).
-- Ritorna `{tappe: [una tappa in classifica per stagione], ritirate: N}`:
-- il server ripubblica in live la classifica generale di quelle stagioni.
drop function public.cancella_account();

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
  if v_riga.ruolo = 'admin' then
    raise exception 'Un account dell''organizzazione non si cancella da qui'
      using errcode = 'check_violation', hint = 'account_admin';
  end if;
  if exists (
    select 1
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    join public.tabelloni tb on tb.id = i.tabellone_id
    where i.utente_id = v_utente
      and i.stato in ('in_attesa', 'confermata')
      and (t.stato = 'in_corso'
        or (t.stato = 'iscrizioni_chiuse' and tb.fase_gioco is not null))
  ) then
    raise exception 'Hai una tappa in corso: potrai cancellare l''account quando sarà finita'
      using errcode = 'check_violation', hint = 'tappa_in_corso';
  end if;

  select count(*) into v_ritirate
  from public.iscrizioni i
  join public.tappe t on t.id = i.tappa_id
  where i.utente_id = v_utente
    and i.stato in ('in_attesa', 'confermata')
    and public.tappa_iscritti_modificabili(t.stato);

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

  perform public.anonimizza_utente(v_utente);
  delete from auth.users where id = v_utente;

  return jsonb_build_object('tappe', v_tappe, 'ritirate', v_ritirate);
end;
$$;

revoke all on function public.cancella_account() from public, anon;
grant execute on function public.cancella_account() to authenticated;
