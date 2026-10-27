-- BLVS-08 · Coda delle email applicative (es. annullamento tappa).
-- Il server Next accoda l'email già resa (oggetto, HTML e testo); la Edge
-- Function `send-emails`, chiamata da pg_cron ogni minuto, la invia con nuovi
-- tentativi a distanza crescente e registra ogni errore.
-- Conferma email e reimpostazione password le invia Supabase Auth con i
-- modelli in supabase/templates.

create type public.stato_email as enum ('in_coda', 'in_invio', 'inviata', 'fallita');

create table public.coda_email (
  id uuid primary key default gen_random_uuid(),
  destinatario text not null check (position('@' in destinatario) > 1),
  modello text not null,
  oggetto text not null,
  html text not null,
  testo text not null,
  stato public.stato_email not null default 'in_coda',
  -- Tentativi già fatti, compreso quello in corso.
  tentativi integer not null default 0 check (tentativi >= 0),
  max_tentativi integer not null default 5 check (max_tentativi between 1 and 20),
  prossimo_tentativo_at timestamptz not null default now(),
  -- Quando un worker l'ha presa; un'email «in_invio» da troppo tempo torna
  -- disponibile (worker interrotto a metà).
  in_invio_da timestamptz,
  ultimo_errore text,
  created_at timestamptz not null default now(),
  inviata_at timestamptz
);

create index coda_email_da_inviare_idx on public.coda_email (prossimo_tentativo_at)
  where stato in ('in_coda', 'in_invio');

create table public.tentativi_email (
  id bigint generated always as identity primary key,
  email_id uuid not null references public.coda_email (id) on delete cascade,
  tentativo integer not null,
  riuscito boolean not null,
  errore text,
  created_at timestamptz not null default now()
);

create index tentativi_email_email_idx on public.tentativi_email (email_id, tentativo);

-- Solo il backend (chiave segreta) tocca la coda: nessun accesso dai client.
alter table public.coda_email enable row level security;
alter table public.tentativi_email enable row level security;
revoke all on public.coda_email, public.tentativi_email from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni del worker
-- ---------------------------------------------------------------------------

-- Prende fino a `quante` email da inviare e conta un nuovo tentativo.
-- SKIP LOCKED: due worker in parallelo non prendono mai la stessa email.
create function public.prendi_email_da_inviare(quante integer default 20)
returns setof public.coda_email
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.coda_email c
  set stato = 'in_invio', tentativi = c.tentativi + 1, in_invio_da = now()
  where c.id in (
    select d.id from public.coda_email d
    where (d.stato = 'in_coda' and d.prossimo_tentativo_at <= now())
       or (d.stato = 'in_invio' and d.in_invio_da < now() - interval '10 minutes')
    order by d.prossimo_tentativo_at
    limit greatest(quante, 0)
    for update skip locked
  )
  returning c.*;
end;
$$;

-- Chiude il tentativo in corso: inviata (p_errore null), da ritentare
-- (p_riprova_at valorizzato) o fallita (p_riprova_at null).
create function public.chiudi_tentativo_email(
  p_email_id uuid,
  p_errore text default null,
  p_riprova_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  numero integer;
begin
  select tentativi into numero
  from public.coda_email
  where id = p_email_id and stato = 'in_invio'
  for update;

  if not found then
    raise exception 'Email % non in invio', p_email_id
      using errcode = 'no_data_found';
  end if;

  insert into public.tentativi_email (email_id, tentativo, riuscito, errore)
  values (p_email_id, numero, p_errore is null, p_errore);

  update public.coda_email
  set
    stato = case
      when p_errore is null then 'inviata'
      when p_riprova_at is null then 'fallita'
      else 'in_coda'
    end::public.stato_email,
    inviata_at = case when p_errore is null then now() end,
    prossimo_tentativo_at = coalesce(p_riprova_at, prossimo_tentativo_at),
    ultimo_errore = p_errore,
    in_invio_da = null
  where id = p_email_id;
end;
$$;

revoke all on function public.prendi_email_da_inviare(integer)
  from public, anon, authenticated;
revoke all on function public.chiudi_tentativo_email(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.prendi_email_da_inviare(integer) to service_role;
grant execute on function public.chiudi_tentativo_email(uuid, text, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Pianificazione: pg_cron chiama la Edge Function ogni minuto via pg_net.
-- URL e segreto stanno nel Vault (vedi README, «Coda email»); senza, il job
-- non fa nulla. Il blocco è saltato dove pg_cron non esiste (PGlite nei test).
-- ---------------------------------------------------------------------------

create function public.avvia_worker_email()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text;
  segreto text;
begin
  if not exists (
    select 1 from public.coda_email
    where (stato = 'in_coda' and prossimo_tentativo_at <= now())
       or (stato = 'in_invio' and in_invio_da < now() - interval '10 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into url
  from vault.decrypted_secrets where name = 'email_worker_url';
  select decrypted_secret into segreto
  from vault.decrypted_secrets where name = 'email_worker_secret';
  if url is null or segreto is null then
    return;
  end if;

  perform net.http_post(
    url := url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || segreto
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.avvia_worker_email() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create extension if not exists pg_net with schema extensions;
    perform cron.schedule(
      'invia-email-in-coda',
      '* * * * *',
      'select public.avvia_worker_email()'
    );
  end if;
end;
$$;
