-- BLVS-07 · Collegamento ad auth.users, registro automatico, ruoli e RLS.
-- Il ruolo vive solo in public.utenti e lo legge il server: mai dal client,
-- mai dai metadati che l'utente può scrivere da sé.

-- ---------------------------------------------------------------------------
-- Ruolo
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.utenti
    where id = (select auth.uid()) and ruolo = 'admin'
  );
$$;

-- Ruolo ed email li cambia solo un admin (o il backend senza JWT, come Auth).
-- Un admin non può togliersi il ruolo da solo: resterebbe senza admin.
create function public.proteggi_campi_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attore uuid := (select auth.uid());
begin
  if attore is null then
    return new;
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

create trigger utenti_proteggi_campi
before update on public.utenti
for each row execute function public.proteggi_campi_utente();

-- ---------------------------------------------------------------------------
-- Sincronizzazione con auth.users
-- ---------------------------------------------------------------------------

-- Ogni nuovo account è un giocatore: i metadati di signUp portano solo dati
-- anagrafici e la versione dell'informativa accettata, mai il ruolo.
create function public.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  categoria_meta text := meta ->> 'categoria';
begin
  insert into public.utenti (id, email, nome, cognome, categoria)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'nome', ''), 100),
    left(coalesce(meta ->> 'cognome', ''), 100),
    case when categoria_meta in ('M', 'F')
      then categoria_meta::public.categoria end
  );

  if nullif(meta ->> 'consenso_privacy', '') is not null then
    insert into public.consensi (utente_id, tipo, versione_informativa, concesso)
    values (new.id, 'privacy', left(meta ->> 'consenso_privacy', 40), true);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.gestisci_nuovo_utente();

create function public.sincronizza_email_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.utenti set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sincronizza_email_utente();

-- ---------------------------------------------------------------------------
-- Registro automatico delle modifiche
-- ---------------------------------------------------------------------------

create function public.scrivi_registro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  riga jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.registro (attore_id, azione, entita, entita_id, dati)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(riga ->> 'id', riga ->> 'partita_id'),
    case when tg_op = 'UPDATE'
      then jsonb_build_object('prima', to_jsonb(old), 'dopo', riga)
      else riga
    end
  );
  return null;
end;
$$;

create trigger tappe_registro
after insert or update or delete on public.tappe
for each row execute function public.scrivi_registro();

create trigger iscrizioni_registro
after insert or update or delete on public.iscrizioni
for each row execute function public.scrivi_registro();

create trigger gironi_registro
after insert or update or delete on public.gironi
for each row execute function public.scrivi_registro();

create trigger partite_registro
after insert or update or delete on public.partite
for each row execute function public.scrivi_registro();

create trigger punteggi_registro
after update on public.punteggi
for each row execute function public.scrivi_registro();

create trigger utenti_registro
after update of ruolo, categoria, email on public.utenti
for each row execute function public.scrivi_registro();

-- ---------------------------------------------------------------------------
-- Privilegi e Row Level Security
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Il contatore dei tentativi lo tocca solo il server con la chiave segreta.
revoke all on public.auth_rate_limits from anon, authenticated;
revoke all on function public.auth_rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.auth_rate_limit_hit(text, integer, integer)
  to service_role;

revoke all on public.registro from anon;
revoke insert, update, delete on public.registro from authenticated;

alter table public.utenti enable row level security;
alter table public.tappe enable row level security;
alter table public.tabelloni enable row level security;
alter table public.iscrizioni enable row level security;
alter table public.gironi enable row level security;
alter table public.girone_iscrizioni enable row level security;
alter table public.partite enable row level security;
alter table public.partita_giocatori enable row level security;
alter table public.punteggi enable row level security;
alter table public.registro enable row level security;
alter table public.consensi enable row level security;
alter table public.auth_rate_limits enable row level security;

-- utenti: ognuno vede e modifica il proprio profilo, l'admin tutti.
create policy utenti_select on public.utenti
for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));

create policy utenti_update on public.utenti
for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check (id = (select auth.uid()) or (select public.is_admin()));

-- tappe: pubbliche tranne le bozze; le scrive solo l'admin.
create policy tappe_select on public.tappe
for select to anon, authenticated
using (stato <> 'bozza' or (select public.is_admin()));

create policy tappe_admin on public.tappe
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- tabelloni: visibili se lo è la tappa.
create policy tabelloni_select on public.tabelloni
for select to anon, authenticated
using (exists (select 1 from public.tappe t where t.id = tappa_id));

create policy tabelloni_admin on public.tabelloni
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- iscrizioni: il giocatore vede le sue e si iscrive solo a tappe aperte.
create policy iscrizioni_select on public.iscrizioni
for select to authenticated
using (utente_id = (select auth.uid()) or (select public.is_admin()));

create policy iscrizioni_insert_giocatore on public.iscrizioni
for insert to authenticated
with check (
  utente_id = (select auth.uid())
  and stato = 'in_attesa'
  and exists (
    select 1 from public.tappe t
    where t.id = tappa_id and t.stato = 'iscrizioni_aperte'
  )
);

create policy iscrizioni_admin on public.iscrizioni
for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Dati di gara: pubblici in lettura, scritti solo dall'admin.
create policy gironi_select on public.gironi
for select to anon, authenticated using (true);
create policy gironi_admin on public.gironi
for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy girone_iscrizioni_select on public.girone_iscrizioni
for select to anon, authenticated using (true);
create policy girone_iscrizioni_admin on public.girone_iscrizioni
for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy partite_select on public.partite
for select to anon, authenticated using (true);
create policy partite_admin on public.partite
for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy partita_giocatori_select on public.partita_giocatori
for select to anon, authenticated using (true);
create policy partita_giocatori_admin on public.partita_giocatori
for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy punteggi_select on public.punteggi
for select to anon, authenticated using (true);
create policy punteggi_admin on public.punteggi
for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- registro: lo legge solo l'admin, lo scrivono solo i trigger.
create policy registro_select on public.registro
for select to authenticated
using ((select public.is_admin()));

-- consensi: ognuno registra e vede i propri.
create policy consensi_select on public.consensi
for select to authenticated
using (utente_id = (select auth.uid()) or (select public.is_admin()));

create policy consensi_insert on public.consensi
for insert to authenticated
with check (utente_id = (select auth.uid()));

-- auth_rate_limits: nessuna policy, nessun accesso dai client.
