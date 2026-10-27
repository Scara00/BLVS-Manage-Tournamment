-- BLVS-24 · Dettaglio della tappa e iscrizione (w-tappa, w-iscrizione-ok).
--
-- - Dati della tappa per il giocatore: ritrovo, programma (testo libero) e
--   scadenza per annullare l'iscrizione.
-- - `iscrizioni.posto`: il numero del posto preso nel tabellone.
-- - Trigger `iscrizioni_posti`: per i giocatori controlla stato, finestra e
--   posti liberi DENTRO una transazione con lock sul tabellone, così 50
--   richieste contemporanee per l'ultimo posto danno una sola iscrizione.
-- - `tabelloni_tappa()` (lettura dei posti di una tappa, bozze escluse) e
--   `iscriviti_tappa()` (iscrizione del giocatore connesso in un solo passo).

-- `if not exists`: la colonna la introducono anche BLVS-17, BLVS-19 e BLVS-23.
alter table public.tabelloni
  add column if not exists posti integer not null default 16;

alter table public.tappe
  add column ritrovo text
    constraint tappe_ritrovo_lunghezza check (char_length(ritrovo) <= 200),
  add column ritrovo_alle timestamptz,
  add column programma text
    constraint tappe_programma_lunghezza check (char_length(programma) <= 2000),
  add column annullabile_fino_al timestamptz;

comment on column public.tappe.annullabile_fino_al is
  'Fino a quando il giocatore può annullare; se nullo vale la scadenza delle iscrizioni.';

alter table public.iscrizioni
  add column posto integer constraint iscrizioni_posto_positivo check (posto >= 1);

-- Un posto è di un solo iscritto attivo: chi si ritira o è rifiutato lo libera.
create unique index iscrizioni_tabellone_posto_key
  on public.iscrizioni (tabellone_id, posto)
  where stato in ('in_attesa', 'confermata');

-- ---------------------------------------------------------------------------
-- Regole dell'iscrizione e posto garantito
-- ---------------------------------------------------------------------------

-- BEFORE INSERT. Il lock `for update` sulla riga del tabellone mette in fila
-- le iscrizioni contemporanee allo stesso tabellone: ognuna conta i posti
-- solo dopo che la precedente ha fatto commit (read committed: ogni
-- istruzione vede i dati confermati fino a quel momento).
-- Giocatori: tappa annullata, iscrizioni chiuse o scadute, già iscritto e
-- posti esauriti alzano un errore con `hint` leggibile dall'app.
-- Admin e backend senza JWT (seed, script) possono andare oltre il massimo.
create function public.verifica_posti_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tappa public.tappe;
  v_posti integer;
  v_occupati integer;
  v_controlla boolean := (select auth.uid()) is not null and not public.is_admin();
begin
  select * into v_tappa from public.tappe where id = new.tappa_id;

  if v_controlla then
    if v_tappa.stato = 'annullata' then
      raise exception 'La tappa è stata annullata.'
        using errcode = 'check_violation', hint = 'annullata';
    end if;
    if v_tappa.stato <> 'iscrizioni_aperte'
      or (v_tappa.iscrizioni_aprono_il is not null
        and v_tappa.iscrizioni_aprono_il > now()) then
      raise exception 'Le iscrizioni a questa tappa sono chiuse.'
        using errcode = 'check_violation', hint = 'chiuse';
    end if;
    if v_tappa.iscrizioni_chiudono_il is not null
      and v_tappa.iscrizioni_chiudono_il <= now() then
      raise exception 'Le iscrizioni a questa tappa sono scadute.'
        using errcode = 'check_violation', hint = 'scadute';
    end if;
    if exists (
      select 1 from public.iscrizioni
      where utente_id = new.utente_id and tappa_id = new.tappa_id
    ) then
      raise exception 'Sei già iscritto a questa tappa.'
        using errcode = 'unique_violation', hint = 'gia_iscritto';
    end if;
  end if;

  select posti into v_posti
  from public.tabelloni
  where id = new.tabellone_id
  for update;

  if new.stato not in ('in_attesa', 'confermata') then
    return new;
  end if;

  select count(*)::integer into v_occupati
  from public.iscrizioni
  where tabellone_id = new.tabellone_id
    and stato in ('in_attesa', 'confermata');

  if v_controlla and v_occupati >= v_posti then
    raise exception 'Posti esauriti in questo tabellone.'
      using errcode = 'check_violation', hint = 'posti_esauriti';
  end if;

  -- Il primo numero libero da 1 al massimo; oltre il massimo (solo admin e
  -- backend) si continua dal più alto.
  if new.posto is null then
    select coalesce(
      (
        select min(n)::integer
        from generate_series(1, v_posti) as n
        where not exists (
          select 1 from public.iscrizioni i
          where i.tabellone_id = new.tabellone_id
            and i.stato in ('in_attesa', 'confermata')
            and i.posto = n
        )
      ),
      (
        select coalesce(max(i.posto), 0) + 1
        from public.iscrizioni i
        where i.tabellone_id = new.tabellone_id
          and i.stato in ('in_attesa', 'confermata')
      )
    ) into new.posto;
  end if;

  return new;
end;
$$;

-- Il nome viene dopo `iscrizioni_email_confermata`: i trigger BEFORE partono
-- in ordine alfabetico, quindi la conferma email resta il primo controllo.
create trigger iscrizioni_posti
before insert on public.iscrizioni
for each row execute function public.verifica_posti_iscrizione();

-- ---------------------------------------------------------------------------
-- Lettura dei posti di una tappa
-- ---------------------------------------------------------------------------

-- I due tabelloni di una tappa visibile a chi chiama: posti, occupati,
-- prossimo numero libero e, solo per le tappe in corso, la fase più
-- avanzata. Security definer perché RLS nasconde le iscrizioni degli altri;
-- restituisce solo numeri. Una bozza (per chi non è admin) o una tappa che
-- non esiste non restituiscono righe, senza distinguere i due casi.
create function public.tabelloni_tappa(p_tappa uuid)
returns table (
  tabellone_id uuid,
  categoria public.categoria,
  posti integer,
  occupati integer,
  prossimo_posto integer,
  fase text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tb.id,
    tb.categoria,
    tb.posti,
    (
      select count(*)::integer
      from public.iscrizioni i
      where i.tabellone_id = tb.id
        and i.stato in ('in_attesa', 'confermata')
    ),
    (
      select min(n)::integer
      from generate_series(1, tb.posti) as n
      where not exists (
        select 1 from public.iscrizioni i
        where i.tabellone_id = tb.id
          and i.stato in ('in_attesa', 'confermata')
          and i.posto = n
      )
    ),
    case
      when t.stato = 'in_corso' then (
        select p.fase
        from public.partite p
        where p.tabellone_id = tb.id
        order by case p.fase
          when 'finale' then 3
          when 'eliminazione' then 2
          else 1
        end desc
        limit 1
      )
    end
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where tb.tappa_id = p_tappa
    and (t.stato <> 'bozza' or public.is_admin())
  order by tb.categoria;
$$;

revoke all on function public.tabelloni_tappa(uuid) from public;
grant execute on function public.tabelloni_tappa(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Iscrizione del giocatore connesso
-- ---------------------------------------------------------------------------

-- Security invoker: valgono RLS, la policy `iscrizioni_insert_giocatore` e
-- i trigger. Una tappa che chi chiama non vede (bozza) o che non esiste dà
-- lo stesso errore P0002, così l'API risponde 404 senza rivelare nulla.
create function public.iscriviti_tappa(p_tappa uuid)
returns public.iscrizioni
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_categoria public.categoria;
  v_tabellone uuid;
  v_iscrizione public.iscrizioni;
begin
  if v_utente is null then
    raise exception 'Accedi per iscriverti.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.tappe
    where id = p_tappa and (stato <> 'bozza' or public.is_admin())
  ) then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;

  select categoria into v_categoria from public.utenti where id = v_utente;
  if v_categoria is null then
    raise exception 'Imposta la tua categoria nel profilo prima di iscriverti.'
      using errcode = 'check_violation', hint = 'categoria_mancante';
  end if;

  select id into v_tabellone
  from public.tabelloni
  where tappa_id = p_tappa and categoria = v_categoria;

  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
  values (p_tappa, v_tabellone, v_utente)
  returning * into v_iscrizione;

  return v_iscrizione;
end;
$$;

revoke all on function public.iscriviti_tappa(uuid) from public, anon;
grant execute on function public.iscriviti_tappa(uuid) to authenticated;
