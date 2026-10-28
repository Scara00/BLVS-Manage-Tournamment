-- BLVS-50 · Scheda del giocatore: account cancellati in forma anonima
-- (R-79, informativa privacy).
--
-- Deleting an account must not change anybody else's standing: the
-- results stay, the person goes. So `utenti` is never deleted any more:
--   - `utenti.anonimizzato_il` marks an account deleted by its owner;
--   - `anonimizza_utente()` blanks the personal data (name «Giocatore
--     anonimo», a dummy email), deletes the consents, withdraws the
--     registrations of stages not started yet and keeps every result;
--   - `cancella_account()` is the player's own request (w-profilo);
--   - deleting the `auth.users` row (Supabase Auth admin API, dashboard)
--     anonymises instead of cascading: the FK `utenti.id → auth.users` is
--     replaced by a trigger;
--   - `classifica_generale_dati()` also returns `anonimo` per registration.

-- ---------------------------------------------------------------------------
-- Marker
-- ---------------------------------------------------------------------------

alter table public.utenti add column if not exists anonimizzato_il timestamptz;

comment on column public.utenti.anonimizzato_il is
  'Account deleted by its owner (BLVS-50): personal data blanked, results kept. Null = active. Set only by anonimizza_utente().';

-- The results outlive the Auth account: no cascade from auth.users.
alter table public.utenti drop constraint if exists utenti_id_fkey;

-- The name every reader shows for a deleted account. Stored as nome/cognome
-- so admin pages, registro names and live boards show it with no change.
-- Mirrored by `NOME_ANONIMO` in src/lib/classifica-generale/giocatore.ts.
create function public.nome_anonimo()
returns table (nome text, cognome text)
language sql
immutable
set search_path = ''
as $$
  select 'Giocatore'::text, 'anonimo'::text;
$$;

-- ---------------------------------------------------------------------------
-- Field guard: the marker is set only through anonimizza_utente(), and a
-- deleted account is frozen (nobody edits it back to a person).
-- ---------------------------------------------------------------------------

create or replace function public.proteggi_campi_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attore uuid := (select auth.uid());
begin
  if current_setting('blvs.anonimizzazione', true) = 'on' then
    return new;
  end if;

  if attore is null then
    return new;
  end if;

  if old.anonimizzato_il is not null then
    raise exception 'L''account è stato cancellato'
      using errcode = 'insufficient_privilege', hint = 'account_cancellato';
  end if;

  if new.anonimizzato_il is distinct from old.anonimizzato_il then
    raise exception 'Un account si cancella solo con la richiesta di cancellazione'
      using errcode = 'insufficient_privilege';
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

-- The technical log would otherwise copy the old email and name into the
-- append-only registro at the very moment they are being erased.
drop trigger if exists utenti_registro on public.utenti;
create trigger utenti_registro
after update of ruolo, categoria, email on public.utenti
for each row
when (current_setting('blvs.anonimizzazione', true) is distinct from 'on')
execute function public.scrivi_registro();

-- Consents went with the deleted user (cascade, right to be forgotten):
-- an anonymised account deletes them too, through anonimizza_utente() only.
create or replace function public.blocca_modifica_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and tg_table_name = 'consensi' then
    if current_setting('blvs.anonimizzazione', true) = 'on'
       or not exists (
         select 1 from public.utenti where id = (to_jsonb(old) ->> 'utente_id')::uuid
       ) then
      return old;
    end if;
  end if;
  raise exception 'La tabella % è in sola aggiunta', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymisation
-- ---------------------------------------------------------------------------

/*
 * Blanks the personal data of `p_utente` and keeps its results. Idempotent:
 * returns false when the account is unknown or already anonymised.
 * Registrations of stages whose list can still change (bozza, iscrizioni
 * aperte/chiuse) are withdrawn, like `admin_rimuovi_iscrizione()`; started,
 * finished and archived stages keep them, so every standing stays as it was.
 * Consents are deleted, as the cascade on a deleted user always did.
 * Not callable by API roles: `cancella_account()` and the auth trigger use it.
 */
create function public.anonimizza_utente(p_utente uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trovato boolean;
begin
  perform set_config('blvs.anonimizzazione', 'on', true);

  delete from public.girone_iscrizioni gi
  using public.iscrizioni i, public.tappe t
  where gi.iscrizione_id = i.id
    and t.id = i.tappa_id
    and i.utente_id = p_utente
    and i.stato in ('in_attesa', 'confermata')
    and public.tappa_iscritti_modificabili(t.stato);

  update public.iscrizioni i
  set stato = 'ritirata'
  from public.tappe t
  where t.id = i.tappa_id
    and i.utente_id = p_utente
    and i.stato in ('in_attesa', 'confermata')
    and public.tappa_iscritti_modificabili(t.stato);

  delete from public.consensi where utente_id = p_utente;

  update public.utenti u
  set nome = a.nome,
      cognome = a.cognome,
      email = 'anonimo-' || u.id::text || '@anonimo.invalid',
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

revoke all on function public.anonimizza_utente(uuid) from public, anon, authenticated;
grant execute on function public.anonimizza_utente(uuid) to service_role;

/*
 * The signed-in player deletes their own account. Refused (23514) with:
 *   - `account_admin`: an admin account is not deleted from w-profilo;
 *   - `tappa_in_corso`: an active registration in a stage being played
 *     (in corso, or registrations closed with a phase already started).
 * Deleting the Auth login is the server action's job (admin API).
 */
create function public.cancella_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := (select auth.uid());
  v_ruolo public.ruolo_utente;
  v_anonimizzato timestamptz;
begin
  if v_id is null then
    raise exception 'Accedi per cancellare l''account'
      using errcode = 'insufficient_privilege';
  end if;

  select ruolo, anonimizzato_il into v_ruolo, v_anonimizzato
  from public.utenti where id = v_id
  for update;
  if not found then
    raise exception 'Account non trovato' using errcode = 'no_data_found';
  end if;
  if v_anonimizzato is not null then
    return false;
  end if;
  if v_ruolo = 'admin' then
    raise exception 'Un account dell''organizzazione non si cancella da qui'
      using errcode = 'check_violation', hint = 'account_admin';
  end if;

  if exists (
    select 1
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    join public.tabelloni tb on tb.id = i.tabellone_id
    where i.utente_id = v_id
      and i.stato in ('in_attesa', 'confermata')
      and (t.stato = 'in_corso'
        or (t.stato = 'iscrizioni_chiuse' and tb.fase_gioco is not null))
  ) then
    raise exception 'Hai una tappa in corso: potrai cancellare l''account quando sarà finita'
      using errcode = 'check_violation', hint = 'tappa_in_corso';
  end if;

  return public.anonimizza_utente(v_id);
end;
$$;

revoke all on function public.cancella_account() from public, anon;
grant execute on function public.cancella_account() to authenticated;

-- Deleting the Auth account (admin API, dashboard) anonymises instead of
-- cascading: the results stay in every standing.
create function public.anonimizza_utente_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.anonimizza_utente(old.id);
  return old;
end;
$$;

create trigger on_auth_user_deleted
after delete on auth.users
for each row execute function public.anonimizza_utente_auth();

-- ---------------------------------------------------------------------------
-- Overall standing: the same rows plus `anonimo` per registration
-- ---------------------------------------------------------------------------

create or replace function public.classifica_generale_dati(
  p_categoria public.categoria,
  p_stagione integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tappe as (
    select t.id, t.nome, t.data_inizio, t.stagione, tb.id as tabellone_id,
      tb.concluso_il is not null as concluso
    from public.tappe t
    join public.tabelloni tb on tb.tappa_id = t.id and tb.categoria = p_categoria
    where public.tappa_in_classifica(t.stato)
      and (p_stagione is null or t.stagione = p_stagione)
  ),
  finali as (
    select g.id, tp.id as tappa_id, g.fase
    from public.gironi g
    join tappe tp on tp.tabellone_id = g.tabellone_id
    where g.fase in ('finale_gold', 'finale_silver')
  ),
  partite_finali as (
    select p.id, p.girone_id, p.stato
    from public.partite p
    join finali f on f.id = p.girone_id
  ),
  giocate as (
    select distinct pg.iscrizione_id
    from public.partita_giocatori pg
    join public.partite p on p.id = pg.partita_id
    join tappe tp on tp.tabellone_id = p.tabellone_id
    where p.stato = 'conclusa'
  ),
  in_finale as (
    select gi.iscrizione_id
    from public.girone_iscrizioni gi
    join finali f on f.id = gi.girone_id
    union
    select pg.iscrizione_id
    from public.partita_giocatori pg
    join partite_finali pf on pf.id = pg.partita_id
  ),
  iscritti as (
    select i.id, i.tappa_id, i.utente_id, i.stato,
      u.anonimizzato_il is not null as anonimo,
      case when u.anonimizzato_il is null then u.nome
        else (select a.nome from public.nome_anonimo() a) end as nome,
      case when u.anonimizzato_il is null then u.cognome
        else (select a.cognome from public.nome_anonimo() a) end as cognome
    from public.iscrizioni i
    join tappe tp on tp.id = i.tappa_id and tp.tabellone_id = i.tabellone_id
    join public.utenti u on u.id = i.utente_id
    where (i.stato in ('confermata', 'ritirata')
        and i.id in (select iscrizione_id from giocate))
      or i.id in (select iscrizione_id from in_finale)
  )
  select jsonb_build_object(
    'tappe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'data_inizio', data_inizio,
        'stagione', stagione, 'concluso', concluso
      ) order by data_inizio, id) from tappe), '[]'::jsonb),
    'gironi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tappa_id', tappa_id, 'fase', fase
      )) from finali), '[]'::jsonb),
    'membri', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', gi.girone_id, 'iscrizione_id', gi.iscrizione_id
      ))
      from public.girone_iscrizioni gi
      join finali f on f.id = gi.girone_id), '[]'::jsonb),
    'partite', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pf.id,
        'girone_id', pf.girone_id,
        'stato', pf.stato,
        'punteggi', jsonb_build_object(
          'sets', coalesce((
            select pu.sets from public.punteggi pu where pu.partita_id = pf.id
          ), '[]'::jsonb)
        ),
        'partita_giocatori', coalesce((
          select jsonb_agg(jsonb_build_object(
            'iscrizione_id', pg.iscrizione_id, 'squadra', pg.squadra
          ))
          from public.partita_giocatori pg where pg.partita_id = pf.id
        ), '[]'::jsonb)
      )) from partite_finali pf), '[]'::jsonb),
    'decisioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', s.girone_id, 'firma', s.firma, 'ordine', to_jsonb(s.ordine)
      ))
      from public.spareggi_girone s
      join finali f on f.id = s.girone_id), '[]'::jsonb),
    'iscrizioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tappa_id', tappa_id, 'utente_id', utente_id,
        'nome', nome, 'cognome', cognome, 'stato', stato, 'anonimo', anonimo
      )) from iscritti), '[]'::jsonb)
  );
$$;
