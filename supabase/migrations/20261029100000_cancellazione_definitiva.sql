-- Cancellazione definitiva dell'account (sostituisce l'anonimizzazione di
-- BLVS-50 e BLVS-53).
--
-- Decisione del cliente (29/10/2026): un account eliminato sparisce dal
-- database con tutto ciò che è suo: profilo, consensi, iscrizioni (anche
-- delle tappe giocate), posti nei gironi e presenza nelle partite. Le
-- classifiche si ricalcolano senza di lui, anche quelle degli altri
-- giocatori che hanno giocato con o contro di lui. Prima l'account restava
-- come «Giocatore anonimo» proprio per non toccare quei risultati.
--
-- - `utenti.id` torna a dipendere da auth.users con `on delete cascade`:
--   eliminare l'utente Auth (dashboard, API admin, `cancella_account()`)
--   elimina il profilo e, a cascata, il resto.
-- - Trigger `utenti_eliminazione` (BEFORE DELETE): accende per la
--   transazione la GUC `blvs.eliminazione_utente`, che fa passare la
--   cascata dove le tappe archiviate, i punteggi e i consensi sono protetti;
--   alza `versione_gironi` dei tabelloni da cui l'utente esce; scrive il
--   registro senza dati personali. La GUC resta accesa fino alla fine della
--   transazione (Postgres esegue i trigger di fine istruzione prima della
--   cascata); `cancella_account()` la spegne appena ha cancellato.
-- - Gli account già anonimizzati (righe senza utente Auth) si eliminano ora.
-- - `anonimizzato_il` resta finché l'app pubblicata la legge, ma deve essere
--   null: un profilo «mezzo cancellato» non può più esistere.

-- ---------------------------------------------------------------------------
-- Protezioni che la cascata attraversa
-- ---------------------------------------------------------------------------

-- Come in BLVS-22 (20261027340100), più la GUC della cancellazione.
create or replace function public.blocca_dati_tappa_chiusa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_righe jsonb[] := array[]::jsonb[];
  v_riga jsonb;
  v_stato public.stato_tappa;
begin
  if current_setting('blvs.eliminazione_utente', true) = 'on' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_righe := v_righe || to_jsonb(new);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_righe := v_righe || to_jsonb(old);
  end if;

  foreach v_riga in array v_righe loop
    select t.stato into v_stato
    from public.tappe t
    where t.id = public.tappa_della_riga(tg_table_name, v_riga);

    if v_stato = 'archiviata' then
      raise exception 'Tappa archiviata: consultabile ma non modificabile'
        using errcode = 'check_violation', hint = 'tappa_archiviata';
    end if;
    if tg_table_name = 'iscrizioni' and tg_op = 'INSERT'
       and v_stato = 'annullata' then
      raise exception 'La tappa è annullata: non accetta nuove iscrizioni'
        using errcode = 'check_violation', hint = 'tappa_annullata';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Come nello schema iniziale, più: la cascata che azzera `aggiornato_da`
-- di un utente eliminato non è una nuova versione del punteggio.
create or replace function public.verifica_versione_punteggio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.versione := 1;
  elsif current_setting('blvs.eliminazione_utente', true) = 'on'
     and new.sets is not distinct from old.sets
     and new.versione = old.versione then
    return new;
  elsif new.versione <> old.versione + 1 then
    raise exception 'Versione del punteggio non valida: attesa %, ricevuta %',
      old.versione + 1, new.versione
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Come in BLVS-50, con la GUC della cancellazione al posto di quella
-- dell'anonimizzazione.
create or replace function public.blocca_modifica_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and tg_table_name = 'consensi' then
    if current_setting('blvs.eliminazione_utente', true) = 'on'
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
-- Eliminazione di un utente
-- ---------------------------------------------------------------------------

create function public.prepara_eliminazione_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('blvs.eliminazione_utente', 'on', true);

  -- I gironi cambiano: le pagine live li rileggono (tappe archiviate escluse,
  -- non sono più in gioco).
  update public.tabelloni tb
  set versione_gironi = tb.versione_gironi + 1
  where tb.id in (
    select i.tabellone_id
    from public.iscrizioni i
    join public.girone_iscrizioni gi on gi.iscrizione_id = i.id
    where i.utente_id = old.id
  )
  and exists (
    select 1 from public.tappe t
    where t.id = tb.tappa_id and t.stato <> 'archiviata'
  );

  insert into public.registro (attore_id, azione, entita, entita_id, dati)
  values (
    (select auth.uid()), 'eliminazione_account', 'utenti', old.id::text,
    jsonb_build_object('eliminato', true)
  );
  return old;
end;
$$;

create trigger utenti_eliminazione
before delete on public.utenti
for each row execute function public.prepara_eliminazione_utente();

-- ---------------------------------------------------------------------------
-- Via l'anonimizzazione
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_deleted on auth.users;
drop function if exists public.anonimizza_utente_auth();
drop trigger if exists iscrizioni_utente_anonimo on public.iscrizioni;
drop function if exists public.blocca_iscrizione_anonimo();

-- Gli account già cancellati: righe anonime e profili senza utente Auth.
delete from public.utenti u
where u.anonimizzato_il is not null
   or not exists (select 1 from auth.users a where a.id = u.id);

drop function if exists public.anonimizza_utente(uuid);

alter table public.utenti drop constraint if exists utenti_email_presente;
alter table public.utenti alter column email set not null;
alter table public.utenti add constraint utenti_mai_anonimizzato
  check (anonimizzato_il is null);

comment on column public.utenti.anonimizzato_il is
  'In dismissione: sempre null da quando un account eliminato si cancella davvero.';

-- Il profilo segue l'utente Auth.
alter table public.utenti drop constraint if exists utenti_id_fkey;
alter table public.utenti add constraint utenti_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

-- Cancella l'account di chi è connesso (mai di un altro: niente parametri):
-- elimina l'utente Auth, e la cascata il resto, in una transazione.
--
-- Errori: 42501 senza sessione; 23514 con hint `gia_cancellato` (il
-- profilo non c'è più), `account_admin` (un account dell'organizzazione non
-- si cancella da qui) o `tappa_in_corso` (un'iscrizione attiva in una tappa
-- che si sta giocando: in corso, o iscrizioni chiuse con una fase già
-- avviata).
-- Ritorna `{tappe, ritirate}`: una tappa in classifica per stagione, da
-- ripubblicare in live, e le iscrizioni attive cancellate nelle tappe non
-- ancora iniziate.
create or replace function public.cancella_account()
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

  delete from auth.users where id = v_utente;
  perform set_config('blvs.eliminazione_utente', 'off', true);

  return jsonb_build_object('tappe', v_tappe, 'ritirate', v_ritirate);
end;
$$;
