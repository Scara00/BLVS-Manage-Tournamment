-- BLVS-07 · Schema dati: utenti, tappe, tabelloni M/F, iscrizioni, gironi,
-- partite, punteggi con versione, registro, consensi, limite tentativi auth.
-- Le password restano in auth.users (Supabase Auth): qui non ne passa nessuna.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------------------

create type public.ruolo_utente as enum ('admin', 'giocatore');
create type public.categoria as enum ('M', 'F');
create type public.stato_tappa as enum (
  'bozza',
  'iscrizioni_aperte',
  'iscrizioni_chiuse',
  'in_corso',
  'conclusa',
  'annullata'
);
create type public.stato_iscrizione as enum (
  'in_attesa',
  'confermata',
  'rifiutata',
  'ritirata'
);
create type public.stato_partita as enum (
  'programmata',
  'in_corso',
  'conclusa',
  'annullata'
);
create type public.tipo_consenso as enum (
  'privacy',
  'regolamento',
  'immagini',
  'marketing'
);

-- ---------------------------------------------------------------------------
-- Utility
-- ---------------------------------------------------------------------------

create function public.imposta_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Utenti (profilo applicativo di auth.users)
-- ---------------------------------------------------------------------------

create table public.utenti (
  id uuid primary key references auth.users (id) on delete cascade,
  -- citext: «Mario@x.it» e «mario@x.it» sono la stessa email.
  email extensions.citext not null,
  ruolo public.ruolo_utente not null default 'giocatore',
  -- Facoltativa per gli admin; senza categoria non ci si può iscrivere.
  categoria public.categoria,
  nome text not null default '' check (char_length(nome) <= 100),
  cognome text not null default '' check (char_length(cognome) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utenti_email_key unique (email),
  constraint utenti_email_formato check (email::text ~ '^[^@[:space:]]+@[^@[:space:]]+$')
);

create trigger utenti_updated_at
before update on public.utenti
for each row execute function public.imposta_updated_at();

-- ---------------------------------------------------------------------------
-- Tappe e tabelloni (sempre due per tappa: M e F)
-- ---------------------------------------------------------------------------

create table public.tappe (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  luogo text not null check (char_length(luogo) between 1 and 200),
  data_inizio date not null,
  data_fine date not null,
  stato public.stato_tappa not null default 'bozza',
  iscrizioni_aprono_il timestamptz,
  iscrizioni_chiudono_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tappe_date check (data_fine >= data_inizio),
  constraint tappe_finestra_iscrizioni check (
    iscrizioni_aprono_il is null
    or iscrizioni_chiudono_il is null
    or iscrizioni_chiudono_il > iscrizioni_aprono_il
  )
);

create trigger tappe_updated_at
before update on public.tappe
for each row execute function public.imposta_updated_at();

create table public.tabelloni (
  id uuid primary key default gen_random_uuid(),
  tappa_id uuid not null references public.tappe (id) on delete cascade,
  categoria public.categoria not null,
  created_at timestamptz not null default now(),
  constraint tabelloni_tappa_categoria_key unique (tappa_id, categoria),
  -- Destinazione della FK composta di iscrizioni (tabellone della stessa tappa).
  constraint tabelloni_id_tappa_key unique (id, tappa_id)
);

create function public.crea_tabelloni_tappa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tabelloni (tappa_id, categoria)
  values (new.id, 'M'), (new.id, 'F');
  return new;
end;
$$;

create trigger tappe_crea_tabelloni
after insert on public.tappe
for each row execute function public.crea_tabelloni_tappa();

-- Un tabellone sparisce solo con la sua tappa.
create function public.blocca_eliminazione_tabellone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.tappe where id = old.tappa_id) then
    raise exception 'Ogni tappa ha sempre i tabelloni M e F'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger tabelloni_blocca_eliminazione
before delete on public.tabelloni
for each row execute function public.blocca_eliminazione_tabellone();

-- ---------------------------------------------------------------------------
-- Iscrizioni (un giocatore, una volta per tappa)
-- ---------------------------------------------------------------------------

create table public.iscrizioni (
  id uuid primary key default gen_random_uuid(),
  tappa_id uuid not null references public.tappe (id) on delete cascade,
  tabellone_id uuid not null,
  utente_id uuid not null references public.utenti (id) on delete cascade,
  stato public.stato_iscrizione not null default 'in_attesa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint iscrizioni_utente_tappa_key unique (utente_id, tappa_id),
  constraint iscrizioni_tabellone_fkey foreign key (tabellone_id, tappa_id)
    references public.tabelloni (id, tappa_id) on delete cascade
);

create index iscrizioni_tabellone_idx on public.iscrizioni (tabellone_id);

create trigger iscrizioni_updated_at
before update on public.iscrizioni
for each row execute function public.imposta_updated_at();

-- Il tabellone deve essere quello della categoria del giocatore.
create function public.verifica_categoria_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.tabelloni t
    join public.utenti u on u.id = new.utente_id
    where t.id = new.tabellone_id and t.categoria = u.categoria
  ) then
    raise exception 'Il tabellone non corrisponde alla categoria del giocatore'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger iscrizioni_categoria
before insert or update of tabellone_id, utente_id on public.iscrizioni
for each row execute function public.verifica_categoria_iscrizione();

-- ---------------------------------------------------------------------------
-- Gironi
-- ---------------------------------------------------------------------------

create table public.gironi (
  id uuid primary key default gen_random_uuid(),
  tabellone_id uuid not null references public.tabelloni (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),
  posizione integer not null default 1 check (posizione >= 1),
  created_at timestamptz not null default now(),
  constraint gironi_tabellone_nome_key unique (tabellone_id, nome)
);

create table public.girone_iscrizioni (
  girone_id uuid not null references public.gironi (id) on delete cascade,
  iscrizione_id uuid not null references public.iscrizioni (id) on delete cascade,
  primary key (girone_id, iscrizione_id),
  -- Un giocatore sta in un solo girone.
  constraint girone_iscrizioni_iscrizione_key unique (iscrizione_id)
);

-- ---------------------------------------------------------------------------
-- Partite e punteggi
-- ---------------------------------------------------------------------------

create table public.partite (
  id uuid primary key default gen_random_uuid(),
  tabellone_id uuid not null references public.tabelloni (id) on delete cascade,
  girone_id uuid references public.gironi (id) on delete cascade,
  fase text not null default 'gironi'
    check (fase in ('gironi', 'eliminazione', 'finale')),
  turno integer not null default 1 check (turno >= 1),
  campo text check (char_length(campo) <= 40),
  programmata_il timestamptz,
  stato public.stato_partita not null default 'programmata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partite_tabellone_idx on public.partite (tabellone_id);

create trigger partite_updated_at
before update on public.partite
for each row execute function public.imposta_updated_at();

-- Le squadre ruotano (formato King/Queen): chi gioca in A e chi in B.
create table public.partita_giocatori (
  partita_id uuid not null references public.partite (id) on delete cascade,
  iscrizione_id uuid not null references public.iscrizioni (id) on delete cascade,
  squadra char(1) not null check (squadra in ('A', 'B')),
  primary key (partita_id, iscrizione_id)
);

create table public.punteggi (
  partita_id uuid primary key references public.partite (id) on delete cascade,
  -- [{ "a": 21, "b": 18 }, …], un elemento per set.
  sets jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sets) = 'array'),
  -- Concorrenza ottimistica: ogni modifica porta versione = precedente + 1.
  versione integer not null default 1 check (versione >= 1),
  aggiornato_da uuid references public.utenti (id) on delete set null,
  updated_at timestamptz not null default now()
);

create function public.crea_punteggio_partita()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.punteggi (partita_id) values (new.id);
  return new;
end;
$$;

create trigger partite_crea_punteggio
after insert on public.partite
for each row execute function public.crea_punteggio_partita();

create function public.verifica_versione_punteggio()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.versione := 1;
  elsif new.versione <> old.versione + 1 then
    raise exception 'Versione del punteggio non valida: attesa %, ricevuta %',
      old.versione + 1, new.versione
      using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger punteggi_versione
before insert or update on public.punteggi
for each row execute function public.verifica_versione_punteggio();

-- ---------------------------------------------------------------------------
-- Registro (append-only) e consensi (storico append-only)
-- ---------------------------------------------------------------------------

create table public.registro (
  id bigint generated always as identity primary key,
  -- Niente FK: la riga sopravvive all'eliminazione dell'utente.
  attore_id uuid,
  azione text not null,
  entita text not null,
  entita_id text,
  dati jsonb,
  created_at timestamptz not null default now()
);

create index registro_created_at_idx on public.registro (created_at desc);

create table public.consensi (
  id bigint generated always as identity primary key,
  utente_id uuid not null references public.utenti (id) on delete cascade,
  tipo public.tipo_consenso not null,
  versione_informativa text not null check (char_length(versione_informativa) between 1 and 40),
  concesso boolean not null,
  created_at timestamptz not null default now()
);

create index consensi_utente_idx on public.consensi (utente_id, tipo, created_at desc);

create function public.blocca_modifica_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- La cancellazione a cascata di un utente (diritto all'oblio) è ammessa.
  if tg_op = 'DELETE' and tg_table_name = 'consensi' then
    if not exists (
      select 1 from public.utenti where id = (to_jsonb(old) ->> 'utente_id')::uuid
    ) then
      return old;
    end if;
  end if;
  raise exception 'La tabella % è in sola aggiunta', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger registro_append_only
before update or delete on public.registro
for each row execute function public.blocca_modifica_append_only();

create trigger consensi_append_only
before update or delete on public.consensi
for each row execute function public.blocca_modifica_append_only();

-- ---------------------------------------------------------------------------
-- Limite ai tentativi sugli endpoint di autenticazione
-- ---------------------------------------------------------------------------

create table public.auth_rate_limits (
  chiave text primary key,
  finestra_inizio timestamptz not null,
  tentativi integer not null
);

-- Conta un tentativo sulla chiave in una finestra fissa e dice se è ammesso.
create function public.auth_rate_limit_hit(
  p_chiave text,
  p_max integer,
  p_finestra_secondi integer
)
returns table (consentito boolean, tentativi integer, reset_il timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  riga public.auth_rate_limits;
begin
  insert into public.auth_rate_limits as r (chiave, finestra_inizio, tentativi)
  values (p_chiave, now(), 1)
  on conflict (chiave) do update
    set finestra_inizio = case
          when r.finestra_inizio + make_interval(secs => p_finestra_secondi) <= now()
            then now()
          else r.finestra_inizio
        end,
        tentativi = case
          when r.finestra_inizio + make_interval(secs => p_finestra_secondi) <= now()
            then 1
          else r.tentativi + 1
        end
  returning * into riga;

  return query select
    riga.tentativi <= p_max,
    riga.tentativi,
    riga.finestra_inizio + make_interval(secs => p_finestra_secondi);
end;
$$;
