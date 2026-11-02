-- Tappa King & Queen mista · 2/2.
--
-- Una tappa ha un formato, scelto alla creazione e poi fisso:
--   classico → due tabelloni indipendenti, M e F (come finora);
--   misto    → un solo tabellone, categoria `X`, dove le squadre sono
--              sempre un uomo e una donna.
--
-- Regole del misto:
-- - `tabelloni.posti` è il massimo di giocatori, sempre pari: metà posti
--   agli uomini e metà alle donne (es. 32 = 16 M + 16 F). Ogni metà si
--   esaurisce da sola.
-- - Gironi da 4 = 2 uomini + 2 donne. Le lettere mettono prima gli uomini
--   (A, B) poi le donne (C, D), così le coppie ruotano restando miste in
--   2 partite: A+C contro B+D, poi A+D contro B+C.
-- - Le fasi sono quelle del classico (gironi iniziali, gold/silver,
--   finali); chi si qualifica lo decide l'app per uomini e donne separati
--   (src/lib/gironi/fasi/qualificazione.ts). Qui i controlli: gironi e
--   finali da 2 + 2 prima dell'avvio.
-- - Un tabellone `X` non entra nella classifica generale: le funzioni
--   della classifica leggono solo i tabelloni M e F.

-- ---------------------------------------------------------------------------
-- Formato della tappa
-- ---------------------------------------------------------------------------

alter table public.tappe
  add column formato text not null default 'classico'
    constraint tappe_formato check (formato in ('classico', 'misto'));

comment on column public.tappe.formato is
  'classico: tabelloni M e F; misto: un solo tabellone X con squadre uomo + donna.';

create function public.blocca_cambio_formato()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.formato is distinct from old.formato then
    raise exception 'Il formato della tappa si sceglie alla creazione e non cambia'
      using errcode = 'check_violation', hint = 'formato_fisso';
  end if;
  return new;
end;
$$;

create trigger tappe_formato_fisso
before update of formato on public.tappe
for each row execute function public.blocca_cambio_formato();

-- `X` è solo dei tabelloni: un giocatore è M o F (o non ha ancora scelto).
alter table public.utenti
  add constraint utenti_categoria_giocatore check (categoria in ('M', 'F'));

-- ---------------------------------------------------------------------------
-- Tabelloni della tappa
-- ---------------------------------------------------------------------------

create or replace function public.crea_tabelloni_tappa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.formato = 'misto' then
    insert into public.tabelloni (tappa_id, categoria) values (new.id, 'X');
  else
    insert into public.tabelloni (tappa_id, categoria)
    values (new.id, 'M'), (new.id, 'F');
  end if;
  return new;
end;
$$;

-- Una tappa classica ha solo i tabelloni M e F, una mista solo X.
create function public.verifica_categoria_tabellone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_formato text;
begin
  select formato into v_formato from public.tappe where id = new.tappa_id;
  if (v_formato = 'misto') is distinct from (new.categoria = 'X') then
    raise exception 'Una tappa mista ha solo il tabellone misto, una classica solo M e F'
      using errcode = 'check_violation', hint = 'categoria_tabellone';
  end if;
  return new;
end;
$$;

create trigger tabelloni_categoria_formato
before insert or update of categoria, tappa_id on public.tabelloni
for each row execute function public.verifica_categoria_tabellone();

create or replace function public.blocca_eliminazione_tabellone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.tappe where id = old.tappa_id) then
    raise exception 'Un tabellone sparisce solo con la sua tappa'
      using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quote dei posti
-- ---------------------------------------------------------------------------

-- I posti di una quota: nel misto metà del massimo per categoria, altrove
-- il massimo intero.
create function public.quota_tabellone(
  p_posti integer,
  p_categoria_tabellone public.categoria
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when p_categoria_tabellone = 'X' then p_posti / 2 else p_posti end;
$$;

-- Iscritti attivi (in attesa o confermati) nella quota di `p_categoria`:
-- nel misto solo quelli di quella categoria, altrove tutti.
create function public.occupati_quota(
  p_tabellone uuid,
  p_categoria public.categoria
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.iscrizioni i
  join public.tabelloni tb on tb.id = i.tabellone_id
  join public.utenti u on u.id = i.utente_id
  where i.tabellone_id = p_tabellone
    and i.stato in ('in_attesa', 'confermata')
    and (tb.categoria <> 'X' or u.categoria = p_categoria);
$$;

revoke all on function public.quota_tabellone(integer, public.categoria) from public;
revoke all on function public.occupati_quota(uuid, public.categoria) from public, anon;
grant execute on function public.quota_tabellone(integer, public.categoria)
  to anon, authenticated, service_role;
grant execute on function public.occupati_quota(uuid, public.categoria)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Creazione e modifica della tappa
-- ---------------------------------------------------------------------------

-- Come `crea_tappa`, con un solo massimo (pari) per il tabellone misto.
create function public.crea_tappa_mista(
  p_nome text,
  p_luogo text,
  p_data date,
  p_scadenza timestamptz,
  p_posti integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può creare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  if p_data <= (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data della tappa deve essere futura'
      using errcode = 'check_violation', hint = 'data_passata';
  end if;

  if p_posti is null or p_posti not between 4 and 256 then
    raise exception 'Il tabellone misto ha tra 4 e 256 posti'
      using errcode = 'check_violation', hint = 'posti';
  end if;

  if p_posti % 2 <> 0 then
    raise exception 'Nel misto i posti sono pari: metà uomini e metà donne'
      using errcode = 'check_violation', hint = 'posti_dispari';
  end if;

  if p_scadenza <= now() then
    raise exception 'La scadenza delle iscrizioni deve essere futura'
      using errcode = 'check_violation', hint = 'scadenza_passata';
  end if;

  if p_scadenza >= (p_data::timestamp at time zone 'Europe/Rome') then
    raise exception 'La scadenza deve precedere la data della tappa'
      using errcode = 'check_violation', hint = 'scadenza_dopo_tappa';
  end if;

  insert into public.tappe (
    nome, luogo, data_inizio, data_fine, iscrizioni_chiudono_il, formato
  )
  values (p_nome, p_luogo, p_data, p_data, p_scadenza, 'misto')
  returning id into v_id;

  update public.tabelloni set posti = p_posti where tappa_id = v_id;

  return v_id;
end;
$$;

revoke all on function public.crea_tappa_mista(text, text, date, timestamptz, integer)
  from public, anon;
grant execute on function public.crea_tappa_mista(text, text, date, timestamptz, integer)
  to authenticated;

-- Nel misto il massimo arriva in `p_posti_m` (`p_posti_f` non conta).
create or replace function public.modifica_tappa(
  p_id uuid,
  p_versione integer,
  p_nome text,
  p_luogo text,
  p_data date,
  p_scadenza timestamptz,
  p_posti_m integer,
  p_posti_f integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_tappa public.tappe;
  v_versione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può modificare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_tappa from public.tappe where id = p_id for update;
  if not found then
    raise exception 'Tappa non trovata' using errcode = 'no_data_found';
  end if;

  if v_tappa.versione <> p_versione then
    raise exception 'La tappa è stata modificata nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = v_tappa.versione::text;
  end if;

  if v_tappa.stato in ('in_corso', 'conclusa', 'annullata') then
    raise exception 'Una tappa % non si può più modificare', v_tappa.stato
      using errcode = 'check_violation', hint = 'tappa_non_modificabile';
  end if;

  -- Data e scadenza già passate restano valide finché non le si cambia.
  if p_data <> v_tappa.data_inizio
    and p_data <= (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data della tappa deve essere futura'
      using errcode = 'check_violation', hint = 'data_passata';
  end if;

  if p_scadenza is distinct from v_tappa.iscrizioni_chiudono_il
    and p_scadenza <= now() then
    raise exception 'La scadenza delle iscrizioni deve essere futura'
      using errcode = 'check_violation', hint = 'scadenza_passata';
  end if;

  if p_scadenza >= (p_data::timestamp at time zone 'Europe/Rome') then
    raise exception 'La scadenza deve precedere la data della tappa'
      using errcode = 'check_violation', hint = 'scadenza_dopo_tappa';
  end if;

  update public.tappe
  set nome = p_nome,
    luogo = p_luogo,
    data_inizio = p_data,
    data_fine = p_data + (v_tappa.data_fine - v_tappa.data_inizio),
    iscrizioni_chiudono_il = p_scadenza
  where id = p_id
  returning versione into v_versione;

  update public.tabelloni
  set posti = case categoria when 'F' then p_posti_f else p_posti_m end
  where tappa_id = p_id
    and posti is distinct from
      case categoria when 'F' then p_posti_f else p_posti_m end;

  return v_versione;
end;
$$;

-- Il massimo non scende sotto gli iscritti; nel misto è pari e ogni metà
-- tiene i suoi iscritti (`detail` resta `<categoria>:<minimo>`).
create or replace function public.blocca_posti_sotto_iscritti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iscritti integer;
begin
  if new.posti is null or new.posti is not distinct from old.posti then
    return new;
  end if;
  if new.categoria = 'X' then
    if new.posti % 2 <> 0 then
      raise exception 'Nel misto i posti sono pari: metà uomini e metà donne'
        using errcode = 'check_violation', hint = 'posti_dispari';
    end if;
    v_iscritti := 2 * greatest(
      public.occupati_quota(new.id, 'M'),
      public.occupati_quota(new.id, 'F')
    );
  else
    v_iscritti := public.iscritti_tabellone(new.id);
  end if;
  if new.posti < v_iscritti then
    raise exception 'Il massimo non può scendere sotto %', v_iscritti
      using errcode = 'check_violation',
        hint = 'posti_sotto_iscritti',
        detail = new.categoria::text || ':' || v_iscritti;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Iscrizioni
-- ---------------------------------------------------------------------------

-- Un giocatore M o F entra nel tabellone della sua categoria o in quello misto.
create or replace function public.verifica_categoria_iscrizione()
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
    where t.id = new.tabellone_id
      and (t.categoria = u.categoria or (t.categoria = 'X' and u.categoria is not null))
  ) then
    raise exception 'Il tabellone non corrisponde alla categoria del giocatore'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Come prima, con la quota della categoria del giocatore nel misto.
create or replace function public.verifica_posti_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tappa public.tappe;
  v_posti integer;
  v_categoria_tabellone public.categoria;
  v_categoria public.categoria;
  v_occupati integer;
  v_controlla boolean := (select auth.uid()) is not null
    and (
      not public.is_admin()
      or current_setting('blvs.iscrizione_propria', true) = 'on'
    );
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

  select posti, categoria into v_posti, v_categoria_tabellone
  from public.tabelloni
  where id = new.tabellone_id
  for update;

  if new.stato not in ('in_attesa', 'confermata') then
    return new;
  end if;

  select categoria into v_categoria from public.utenti where id = new.utente_id;
  v_occupati := public.occupati_quota(new.tabellone_id, v_categoria);

  if v_controlla
    and v_occupati >= public.quota_tabellone(v_posti, v_categoria_tabellone) then
    raise exception 'Posti esauriti in questo tabellone.'
      using errcode = 'check_violation', hint = 'posti_esauriti';
  end if;

  -- Il primo numero libero da 1 al massimo; oltre il massimo (solo admin e
  -- backend) si continua dal più alto. Nel misto i numeri sono unici per
  -- tutto il tabellone.
  if new.posto is null then
    new.posto := public.primo_posto_libero(new.tabellone_id);
  end if;

  return new;
end;
$$;

create or replace function public.iscriviti_tappa(p_tappa uuid)
returns public.iscrizioni
language plpgsql
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
    select 1 from public.tappe where id = p_tappa and stato <> 'bozza'
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
  where tappa_id = p_tappa and categoria in (v_categoria, 'X');

  perform public.elimina_iscrizione_annullata(p_tappa);

  perform set_config('blvs.iscrizione_propria', 'on', true);
  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
  values (p_tappa, v_tabellone, v_utente)
  returning * into v_iscrizione;
  perform set_config('blvs.iscrizione_propria', 'off', true);

  return v_iscrizione;
end;
$$;

create or replace function public.admin_iscrivi_giocatore(p_tappa uuid, p_utente uuid)
returns public.iscrizioni
language plpgsql
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
  v_categoria public.categoria;
  v_tabellone uuid;
  v_categoria_tabellone public.categoria;
  v_posti integer;
  v_iscrizione public.iscrizioni;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può iscrivere un giocatore.'
      using errcode = 'insufficient_privilege';
  end if;

  select stato into v_stato from public.tappe where id = p_tappa;
  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;
  if v_stato = 'archiviata' then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_stato = 'annullata' then
    raise exception 'La tappa è annullata: non accetta nuove iscrizioni'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;
  if not public.tappa_iscritti_modificabili(v_stato) then
    raise exception 'Con la tappa in corso o conclusa gli iscritti non cambiano più.'
      using errcode = 'check_violation', hint = 'tappa_non_iscrivibile';
  end if;

  select categoria into v_categoria
  from public.utenti where id = p_utente;
  if not found then
    raise exception 'Giocatore non trovato.'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;
  if v_categoria is null then
    raise exception 'Il giocatore non ha ancora scelto la categoria.'
      using errcode = 'check_violation', hint = 'categoria_mancante';
  end if;

  -- Stesso lock del trigger `iscrizioni_posti`: aggiunte e iscrizioni
  -- contemporanee allo stesso tabellone si mettono in fila qui.
  select id, posti, categoria into v_tabellone, v_posti, v_categoria_tabellone
  from public.tabelloni
  where tappa_id = p_tappa and categoria in (v_categoria, 'X')
  for update;

  if exists (
    select 1 from public.iscrizioni
    where utente_id = p_utente and tappa_id = p_tappa
      and stato in ('in_attesa', 'confermata')
  ) then
    raise exception 'Il giocatore è già iscritto a questa tappa.'
      using errcode = 'unique_violation', hint = 'gia_iscritto';
  end if;

  if public.occupati_quota(v_tabellone, v_categoria)
    >= public.quota_tabellone(v_posti, v_categoria_tabellone) then
    raise exception 'Posti esauriti in questo tabellone.'
      using errcode = 'check_violation', hint = 'posti_esauriti';
  end if;

  delete from public.iscrizioni
  where utente_id = p_utente and tappa_id = p_tappa
    and stato not in ('in_attesa', 'confermata');

  -- Aggiunta dall'admin: l'iscrizione è già confermata.
  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id, stato)
  values (p_tappa, v_tabellone, p_utente, 'confermata')
  returning * into v_iscrizione;

  return v_iscrizione;
end;
$$;

-- ---------------------------------------------------------------------------
-- Posti letti dai giocatori
-- ---------------------------------------------------------------------------

-- Il tabellone misto compare come due righe, M e F, ognuna con la sua
-- quota: il giocatore vede i posti liberi della propria categoria.
create or replace function public.posti_tappe()
returns table (
  tappa_id uuid,
  categoria public.categoria,
  posti integer,
  occupati integer,
  fase text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tb.tappa_id,
    q.categoria,
    public.quota_tabellone(tb.posti, tb.categoria),
    public.occupati_quota(tb.id, q.categoria),
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
  cross join lateral (
    select c
    from unnest(
      case when tb.categoria = 'X'
        then array['M', 'F']::public.categoria[]
        else array[tb.categoria]
      end
    ) as c
  ) as q (categoria)
  where t.stato <> 'bozza';
$$;

create or replace function public.tabelloni_tappa(p_tappa uuid)
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
    q.categoria,
    public.quota_tabellone(tb.posti, tb.categoria),
    public.occupati_quota(tb.id, q.categoria),
    case
      when public.occupati_quota(tb.id, q.categoria)
        < public.quota_tabellone(tb.posti, tb.categoria)
      then (
        select min(n)::integer
        from generate_series(1, tb.posti) as n
        where not exists (
          select 1 from public.iscrizioni i
          where i.tabellone_id = tb.id
            and i.stato in ('in_attesa', 'confermata')
            and i.posto = n
        )
      )
    end,
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
  cross join lateral (
    select c
    from unnest(
      case when tb.categoria = 'X'
        then array['M', 'F']::public.categoria[]
        else array[tb.categoria]
      end
    ) as c
  ) as q (categoria)
  where tb.tappa_id = p_tappa
    and (t.stato <> 'bozza' or public.is_admin())
  order by q.categoria;
$$;

-- Riepilogo admin: nel misto anche gli iscritti per categoria.
create or replace function public.admin_riepilogo_tappe()
returns table (
  id uuid,
  nome text,
  data_inizio date,
  data_fine date,
  stato public.stato_tappa,
  motivo_annullamento text,
  categorie jsonb,
  partite_da_inserire integer
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Riepilogo riservato agli admin'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    t.id,
    t.nome,
    t.data_inizio,
    t.data_fine,
    t.stato,
    t.motivo_annullamento,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'categoria', tb.categoria,
            'posti', tb.posti,
            'fase', tb.fase,
            'concluso', tb.concluso_il is not null,
            'iscritti', (
              select count(*)
              from public.iscrizioni i
              where i.tabellone_id = tb.id
                and i.stato in ('in_attesa', 'confermata')
            )
          )
          || case when tb.categoria = 'X' then jsonb_build_object(
            'iscritti_m', public.occupati_quota(tb.id, 'M'),
            'iscritti_f', public.occupati_quota(tb.id, 'F')
          ) else '{}'::jsonb end
          order by tb.categoria
        )
        from public.tabelloni tb
        where tb.tappa_id = t.id
      ),
      '[]'::jsonb
    ),
    (
      select count(*)::integer
      from public.partite p
      join public.tabelloni tb on tb.id = p.tabellone_id
      left join public.punteggi pt on pt.partita_id = p.id
      where tb.tappa_id = t.id
        and (
          p.stato = 'in_corso'
          or (
            p.stato = 'programmata'
            and p.programmata_il <= now()
            and coalesce(jsonb_array_length(pt.sets), 0) = 0
          )
        )
    )
  from public.tappe t
  order by t.data_inizio, t.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gironi e partite
-- ---------------------------------------------------------------------------

-- Nel misto prima gli uomini (A, B) e poi le donne (C, D); `categoria` è
-- quella del giocatore.
drop function public.giocatori_girone(uuid);

create function public.giocatori_girone(p_girone uuid)
returns table (
  lettera text,
  iscrizione_id uuid,
  utente_id uuid,
  nome text,
  cognome text,
  categoria public.categoria
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chr(64 + (row_number() over (
      order by case when tb.categoria = 'X' then u.categoria end nulls first,
        i.posto nulls last, u.cognome, u.nome, i.id
    ))::integer),
    i.id,
    u.id,
    u.nome,
    u.cognome,
    u.categoria
  from public.girone_iscrizioni gi
  join public.gironi g on g.id = gi.girone_id
  join public.tabelloni tb on tb.id = g.tabellone_id
  join public.iscrizioni i on i.id = gi.iscrizione_id
  join public.utenti u on u.id = i.utente_id
  where gi.girone_id = p_girone and i.stato = 'confermata'
  order by case when tb.categoria = 'X' then u.categoria end nulls first,
    i.posto nulls last, u.cognome, u.nome, i.id;
$$;

grant execute on function public.giocatori_girone(uuid) to anon, authenticated;

-- Classico: 3 turni (A+B|C+D, A+C|B+D, A+D|B+C). Misto: solo le due
-- rotazioni con coppie miste, A+C|B+D e A+D|B+C, come turni 1 e 2.
create or replace function public.crea_partite_girone(
  p_tabellone uuid,
  p_girone uuid,
  p_fase_partita text
)
returns table (partita_id uuid, turno integer)
language plpgsql
set search_path = ''
as $$
declare
  v_partita uuid;
  v_turno integer;
  v_salto integer;
begin
  select case when tb.categoria = 'X' then 1 else 0 end into v_salto
  from public.tabelloni tb
  where tb.id = p_tabellone;

  for v_turno in 1 .. 3 - coalesce(v_salto, 0) loop
    insert into public.partite (tabellone_id, girone_id, fase, turno, stato)
    values (p_tabellone, p_girone, p_fase_partita, v_turno, 'programmata')
    returning id into v_partita;

    insert into public.partita_giocatori (partita_id, iscrizione_id, squadra)
    select v_partita, gg.iscrizione_id, r.squadra
    from (
      values
        (1, 'A', 'A'), (1, 'B', 'A'), (1, 'C', 'B'), (1, 'D', 'B'),
        (2, 'A', 'A'), (2, 'C', 'A'), (2, 'B', 'B'), (2, 'D', 'B'),
        (3, 'A', 'A'), (3, 'D', 'A'), (3, 'B', 'B'), (3, 'C', 'B')
    ) as r (turno, lettera, squadra)
    join public.giocatori_girone(p_girone) gg on gg.lettera = r.lettera
    where r.turno = v_turno + coalesce(v_salto, 0);

    partita_id := v_partita;
    turno := v_turno;
    return next;
  end loop;
end;
$$;

-- Sorteggio del misto: uomini e donne mescolati a parte, ogni girone ne
-- prende 2 + 2. Chi resta senza girone (quote non pari) è solo segnalato.
create function public.sorteggia_gironi_misto(p_tabellone uuid)
returns table (gironi integer, partite integer, esclusi jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v_m uuid[];
  v_f uuid[];
  v_completi integer;
  v_esclusi uuid[];
  v_girone uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può generare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select
    coalesce(array_agg(i.id order by random()) filter (where u.categoria = 'M'), array[]::uuid[]),
    coalesce(array_agg(i.id order by random()) filter (where u.categoria = 'F'), array[]::uuid[])
  into v_m, v_f
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  where i.tabellone_id = p_tabellone and i.stato = 'confermata';

  v_completi := least(cardinality(v_m), cardinality(v_f)) / 2;
  v_esclusi := v_m[v_completi * 2 + 1 : cardinality(v_m)]
    || v_f[v_completi * 2 + 1 : cardinality(v_f)];

  for g in 1 .. v_completi loop
    insert into public.gironi (tabellone_id, nome, posizione)
    values (
      p_tabellone,
      'Girone ' || case when g <= 26 then chr(64 + g) else g::text end,
      g
    )
    returning id into v_girone;

    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    select v_girone, x
    from unnest(array[v_m[2 * g - 1], v_m[2 * g], v_f[2 * g - 1], v_f[2 * g]]) as x;

    perform public.crea_partite_girone(p_tabellone, v_girone, 'gironi');
  end loop;

  gironi := v_completi;
  partite := v_completi * 2;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'iscrizione_id', i.id,
        'utente_id', u.id,
        'nome', u.nome,
        'cognome', u.cognome,
        'posto', i.posto
      )
      order by i.posto nulls last, u.cognome, u.nome
    ),
    '[]'::jsonb
  )
  into esclusi
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  where i.id = any (v_esclusi);
  return next;
end;
$$;

revoke all on function public.sorteggia_gironi_misto(uuid) from public, anon;
grant execute on function public.sorteggia_gironi_misto(uuid) to authenticated;

-- Il sorteggio di un tabellone: quello misto ha il suo.
create or replace function public.sorteggia_gironi_tabellone(p_tabellone uuid)
returns table (gironi integer, partite integer, esclusi jsonb)
language plpgsql
set search_path = ''
as $$
declare
  v_iscritti uuid[];
  v_esclusi uuid[];
  v_completi integer;
  v_girone uuid;
  v_partita uuid;
  v_n integer;
  v_turno integer;
  -- Indici (1..4) delle coppie per turno: A+B|C+D, A+C|B+D, A+D|B+C.
  v_squadra_a integer[][] := array[[1, 2], [1, 3], [1, 4]];
  v_squadra_b integer[][] := array[[3, 4], [2, 4], [2, 3]];
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può generare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.tabelloni tb
    where tb.id = p_tabellone and tb.categoria = 'X'
  ) then
    return query select * from public.sorteggia_gironi_misto(p_tabellone);
    return;
  end if;

  -- Il sorteggio: un ordine casuale decide gironi, posizioni ed esclusi.
  select coalesce(array_agg(i.id order by random()), array[]::uuid[])
  into v_iscritti
  from public.iscrizioni i
  where i.tabellone_id = p_tabellone and i.stato = 'confermata';

  v_n := cardinality(v_iscritti);
  v_completi := v_n / 4;
  v_esclusi := v_iscritti[v_completi * 4 + 1 : v_n];

  for g in 1 .. v_completi loop
    insert into public.gironi (tabellone_id, nome, posizione)
    values (
      p_tabellone,
      'Girone ' || case when g <= 26 then chr(64 + g) else g::text end,
      g
    )
    returning id into v_girone;

    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    select v_girone, v_iscritti[(g - 1) * 4 + k]
    from generate_series(1, 4) as k;

    for v_turno in 1 .. 3 loop
      insert into public.partite (tabellone_id, girone_id, fase, turno)
      values (p_tabellone, v_girone, 'gironi', v_turno)
      returning id into v_partita;

      insert into public.partita_giocatori (partita_id, iscrizione_id, squadra)
      select v_partita, v_iscritti[(g - 1) * 4 + s.k], s.squadra
      from (
        values
          (v_squadra_a[v_turno][1], 'A'),
          (v_squadra_a[v_turno][2], 'A'),
          (v_squadra_b[v_turno][1], 'B'),
          (v_squadra_b[v_turno][2], 'B')
      ) as s (k, squadra);
    end loop;
  end loop;

  gironi := v_completi;
  partite := v_completi * 3;
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'iscrizione_id', i.id,
        'utente_id', u.id,
        'nome', u.nome,
        'cognome', u.cognome,
        'posto', i.posto
      )
      order by i.posto nulls last, u.cognome, u.nome
    ),
    '[]'::jsonb
  )
  into esclusi
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  where i.id = any (v_esclusi);
  return next;
end;
$$;

-- Controlli prima dell'avvio: nel misto ogni girone da 4 è 2 uomini + 2
-- donne (`girone_non_misto`, dettaglio «uomini:donne»).
create or replace function public.controlli_avvio_fase(p_tabellone uuid)
returns table (regola text, girone_id uuid, girone_nome text, dettaglio text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_regola record;
  v_livello text;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_regola from public.regola_avvio();
  v_livello := public.livello_modificabile(p_tabellone);

  if not exists (
    select 1 from public.gironi g
    where g.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = v_livello
  ) then
    regola := 'nessun_girone';
    girone_id := null;
    girone_nome := null;
    dettaglio := null;
    return next;
  end if;

  return query
  select 'girone_non_da_4'::text, g.id, g.nome, count(i.id)::text
  from public.gironi g
  left join public.girone_iscrizioni gi on gi.girone_id = g.id
  left join public.iscrizioni i
    on i.id = gi.iscrizione_id and i.stato = 'confermata'
  where g.tabellone_id = p_tabellone
    and public.livello_girone(g.fase) = v_livello
  group by g.id, g.nome, g.posizione
  having count(i.id) <> v_regola.dimensione
  order by g.posizione, g.nome;

  if exists (
    select 1 from public.tabelloni tb
    where tb.id = p_tabellone and tb.categoria = 'X'
  ) then
    return query
    select
      'girone_non_misto'::text,
      g.id,
      g.nome,
      (count(*) filter (where u.categoria = 'M'))::text || ':'
        || (count(*) filter (where u.categoria = 'F'))::text
    from public.gironi g
    join public.girone_iscrizioni gi on gi.girone_id = g.id
    join public.iscrizioni i
      on i.id = gi.iscrizione_id and i.stato = 'confermata'
    join public.utenti u on u.id = i.utente_id
    where g.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = v_livello
    group by g.id, g.nome, g.posizione
    having count(*) = v_regola.dimensione
      and count(*) filter (where u.categoria = 'M') <> v_regola.dimensione / 2
    order by g.posizione, g.nome;
  end if;

  return query
  select
    'doppione'::text,
    g.id,
    g.nome,
    trim(u.cognome || ' ' || u.nome)
  from public.gironi g
  join public.girone_iscrizioni gi on gi.girone_id = g.id
  join public.iscrizioni i on i.id = gi.iscrizione_id
  join public.utenti u on u.id = i.utente_id
  where g.tabellone_id = p_tabellone
    and public.livello_girone(g.fase) = v_livello
    and i.utente_id in (
      select i2.utente_id
      from public.gironi g2
      join public.girone_iscrizioni gi2 on gi2.girone_id = g2.id
      join public.iscrizioni i2 on i2.id = gi2.iscrizione_id
      where g2.tabellone_id = p_tabellone
        and public.livello_girone(g2.fase) = v_livello
      group by i2.utente_id
      having count(*) > 1
    )
  order by g.posizione, g.nome, u.cognome, u.nome;

  return query
  with fuori as (
    select i.id, u.cognome, u.nome
    from public.iscrizioni i
    join public.utenti u on u.id = i.utente_id
    where i.id in (select public.gironi_fuori_livello(p_tabellone, v_livello))
  )
  select 'non_assegnato'::text, null::uuid, null::text,
    trim(f.cognome || ' ' || f.nome)
  from fuori f
  where not (
    v_regola.ammetti_resto
    and (select count(*) from fuori) < v_regola.dimensione
  )
  order by f.cognome, f.nome;
end;
$$;

-- Finali: nel misto ognuna è 2 uomini + 2 donne.
create or replace function public.genera_finali(p_tabellone uuid, p_finali jsonb)
returns table (partita_id uuid, girone_id uuid, girone_nome text, turno integer)
language plpgsql
set search_path = ''
as $$
declare
  v_fase text;
  v_stato public.stato_tappa;
  v_misto boolean;
  v_giocatori integer;
  v_finale jsonb;
  v_colore text;
  v_id uuid;
  v_nome text;
  v_iscrizione text;
  v_partita record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può generare le finali'
      using errcode = 'insufficient_privilege';
  end if;

  select tb.fase_gioco, t.stato, tb.categoria = 'X'
  into v_fase, v_stato, v_misto
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where tb.id = p_tabellone
  for update of tb;
  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  if v_stato <> 'in_corso' then
    raise exception 'Le finali si generano a tappa in corso'
      using errcode = 'check_violation', hint = 'tappa_non_avviabile';
  end if;
  if v_fase = 'finali' then
    raise exception 'Le finali sono già generate'
      using errcode = 'check_violation', hint = 'finali_gia_generate';
  end if;
  if v_fase is distinct from 'gironi_gold_silver' then
    raise exception 'Le finali si generano dopo i gironi gold e silver'
      using errcode = 'check_violation', hint = 'fase_non_proponibile';
  end if;
  if not public.livello_concluso(p_tabellone, 'gold_silver') then
    raise exception 'I gironi gold e silver non sono ancora conclusi'
      using errcode = 'check_violation', hint = 'gironi_non_conclusi';
  end if;

  select r.giocatori into v_giocatori from public.regola_finali() r;

  if jsonb_typeof(p_finali) <> 'array' or jsonb_array_length(p_finali) = 0 then
    raise exception 'Nessuna finale'
      using errcode = 'check_violation', hint = 'finale_non_valida';
  end if;

  for v_finale in select * from jsonb_array_elements(p_finali) loop
    v_colore := case v_finale ->> 'fase'
      when 'finale_gold' then 'gold'
      when 'finale_silver' then 'silver'
    end;
    if v_colore is null
      or jsonb_array_length(v_finale -> 'iscrizioni') <> v_giocatori then
      raise exception 'Finale non valida'
        using errcode = 'check_violation', hint = 'finale_non_valida';
    end if;

    v_nome := case v_colore when 'gold' then 'Finale gold' else 'Finale silver' end;
    insert into public.gironi (tabellone_id, nome, posizione, fase)
    select p_tabellone, v_nome, coalesce(max(g.posizione), 0) + 1, v_finale ->> 'fase'
    from public.gironi g
    where g.tabellone_id = p_tabellone
    returning id into v_id;

    for v_iscrizione in
      select * from jsonb_array_elements_text(v_finale -> 'iscrizioni')
    loop
      if not exists (
        select 1 from public.girone_iscrizioni gi
        join public.gironi g on g.id = gi.girone_id
        where gi.iscrizione_id = v_iscrizione::uuid
          and g.tabellone_id = p_tabellone
          and g.fase = v_colore
      ) then
        raise exception 'Il giocatore non arriva da un girone %', v_colore
          using errcode = 'check_violation', hint = 'finale_non_valida';
      end if;
      begin
        insert into public.girone_iscrizioni (girone_id, iscrizione_id)
        values (v_id, v_iscrizione::uuid);
      exception when unique_violation then
        raise exception 'Lo stesso giocatore compare due volte'
          using errcode = 'check_violation', hint = 'finale_non_valida';
      end;
    end loop;

    if v_misto and (
      select count(*)
      from public.girone_iscrizioni gi
      join public.iscrizioni i on i.id = gi.iscrizione_id
      join public.utenti u on u.id = i.utente_id
      where gi.girone_id = v_id and u.categoria = 'M'
    ) <> v_giocatori / 2 then
      raise exception 'Nel misto una finale è metà uomini e metà donne'
        using errcode = 'check_violation', hint = 'finale_non_valida';
    end if;

    for v_partita in
      select * from public.crea_partite_girone(p_tabellone, v_id, 'finale')
    loop
      partita_id := v_partita.partita_id;
      girone_id := v_id;
      girone_nome := v_nome;
      turno := v_partita.turno;
      return next;
    end loop;
  end loop;

  update public.tabelloni
  set fase_gioco = 'finali', fase_avviata_il = now(),
    versione_gironi = versione_gironi + 1
  where id = p_tabellone;
end;
$$;

-- Editor dei gironi: nel misto ogni giocatore porta la sua categoria
-- (null negli altri tabelloni), così l'admin tiene i gironi 2 + 2.
create or replace function public.gironi_editor(p_tabellone uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tabellone public.tabelloni;
  v_livello text;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_tabellone from public.tabelloni where id = p_tabellone;
  if not found then
    raise exception 'Tabellone non trovato' using errcode = 'no_data_found';
  end if;
  v_livello := public.livello_modificabile(p_tabellone);

  return jsonb_build_object(
    'tabellone_id', v_tabellone.id,
    'fase', v_tabellone.fase,
    'livello', v_livello,
    'versione', v_tabellone.versione_gironi,
    'bloccata', public.gironi_livello_bloccato(p_tabellone, v_livello),
    'gironi', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'nome', g.nome,
          'posizione', g.posizione,
          'fase', g.fase,
          'giocatori', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'iscrizione_id', i.id,
                'nome', public.gironi_nome_giocatore(u),
                'categoria',
                case when v_tabellone.categoria = 'X' then u.categoria end
              )
              order by u.cognome, u.nome, i.id
            )
            from public.girone_iscrizioni gi
            join public.iscrizioni i on i.id = gi.iscrizione_id
            join public.utenti u on u.id = i.utente_id
            where gi.girone_id = g.id
          ), '[]'::jsonb)
        )
        order by g.posizione, g.nome
      )
      from public.gironi g
      where g.tabellone_id = p_tabellone
        and public.livello_girone(g.fase) = v_livello
    ), '[]'::jsonb),
    'non_assegnati', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'iscrizione_id', i.id,
          'nome', public.gironi_nome_giocatore(u),
          'categoria',
          case when v_tabellone.categoria = 'X' then u.categoria end
        )
        order by u.cognome, u.nome, i.id
      )
      from public.iscrizioni i
      join public.utenti u on u.id = i.utente_id
      where i.id in (select public.gironi_fuori_livello(p_tabellone, v_livello))
    ), '[]'::jsonb)
  );
end;
$$;
