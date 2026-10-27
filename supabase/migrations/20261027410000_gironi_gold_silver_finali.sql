-- BLVS-39 · Gironi gold e silver e finali (R-09, R-28, R-29, R-30, R-40).
--
-- Dopo i gironi iniziali di un tabellone l'admin propone i gironi gold
-- (1° e 2° di ogni girone) e silver (3° e 4°), li controlla e li modifica
-- nell'editor (BLVS-28), poi li avvia (BLVS-29). Concluse gold e silver,
-- genera la finale gold e la finale silver. Il tabellone passa per
--   fase_gioco: gironi_iniziali → gironi_gold_silver → finali.
--
-- Modello: ogni girone ha la sua fase (`gironi.fase`). I gironi di un
-- tabellone stanno su tre «livelli», uno per fase di gioco:
--   iniziale      → gironi iniziali
--   gold, silver  → gironi gold e silver
--   finale_gold, finale_silver → finali
-- Un giocatore sta in un solo girone per livello
-- (`girone_iscrizioni.livello`), quindi conserva il suo girone iniziale
-- quando entra in un girone gold o silver.
--
-- La classifica resta calcolata in TS (BLVS-27): la qualificazione e il
-- blocco per parità (`puoAvanzare`) li decide il server action; queste
-- funzioni controllano solo che la fase precedente sia conclusa e che i
-- giocatori arrivino dalla fase giusta.

-- ---------------------------------------------------------------------------
-- Fase di ogni girone, livelli
-- ---------------------------------------------------------------------------

alter table public.gironi
  add column if not exists fase text not null default 'iniziale'
    constraint gironi_fase check (
      fase in ('iniziale', 'gold', 'silver', 'finale_gold', 'finale_silver')
    );

comment on column public.gironi.fase is
  'Fase del girone (BLVS-39): iniziale, gold, silver, finale_gold, finale_silver.';

create function public.livello_girone(p_fase text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_fase = 'iniziale' then 'iniziale'
    when p_fase in ('gold', 'silver') then 'gold_silver'
    else 'finali'
  end;
$$;

grant execute on function public.livello_girone(text) to anon, authenticated;

alter table public.girone_iscrizioni
  add column if not exists livello text not null default 'iniziale'
    constraint girone_iscrizioni_livello check (
      livello in ('iniziale', 'gold_silver', 'finali')
    );

create function public.girone_iscrizioni_livello()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select public.livello_girone(g.fase) into new.livello
  from public.gironi g
  where g.id = new.girone_id;
  return new;
end;
$$;

create trigger girone_iscrizioni_livello
before insert or update of girone_id on public.girone_iscrizioni
for each row execute function public.girone_iscrizioni_livello();

-- Same name as before (tests drop it by name): one group per player and
-- level instead of one group per player.
alter table public.girone_iscrizioni
  drop constraint girone_iscrizioni_iscrizione_key;
alter table public.girone_iscrizioni
  add constraint girone_iscrizioni_iscrizione_key unique (iscrizione_id, livello);

-- Fasi di gioco: mirror di FASI_GIOCO in src/lib/db/types.ts.
alter table public.tabelloni drop constraint tabelloni_fase_gioco;
alter table public.tabelloni
  add constraint tabelloni_fase_gioco check (
    fase_gioco in ('gironi_iniziali', 'gironi_gold_silver', 'finali')
  );

comment on column public.tabelloni.fase_gioco is
  'Fase di gioco avviata: null, gironi_iniziali (BLVS-29), gironi_gold_silver, finali (BLVS-39).';

-- ---------------------------------------------------------------------------
-- Regole configurabili (Q-01)
-- ---------------------------------------------------------------------------

-- TODO(Q-01): da confermare col cliente. Mirror di REGOLA_QUALIFICAZIONE
-- e REGOLA_FINALI in src/lib/gironi/fasi/regole.ts: cambiale insieme.
create function public.regola_qualificazione()
returns table (gold integer[], silver integer[])
language sql
immutable
set search_path = ''
as $$
  select array[1, 2], array[3, 4];
$$;

-- Una finale è un girone King/Queen di `giocatori` giocatori.
create function public.regola_finali()
returns table (giocatori integer)
language sql
immutable
set search_path = ''
as $$
  select 4;
$$;

grant execute on function public.regola_qualificazione() to anon, authenticated;
grant execute on function public.regola_finali() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Livello modificabile
-- ---------------------------------------------------------------------------

-- The level the editor and the start screen work on: the initial groups
-- until a gold/silver proposal exists, then the gold/silver groups, then
-- the finals.
create function public.livello_modificabile(p_tabellone uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when tb.fase_gioco = 'finali' then 'finali'
    when tb.fase_gioco = 'gironi_gold_silver' then 'gold_silver'
    when tb.fase_gioco = 'gironi_iniziali' and exists (
      select 1 from public.gironi g
      where g.tabellone_id = tb.id and g.fase in ('gold', 'silver')
    ) then 'gold_silver'
    else 'iniziale'
  end
  from public.tabelloni tb
  where tb.id = p_tabellone;
$$;

-- The groups of `p_livello` can no longer change. Initial groups: as in
-- BLVS-28, once one of their matches has started. Gold/silver groups: also
-- once their phase is started (their matches are not recreated). Finals:
-- always (they are generated with their matches).
create function public.gironi_livello_bloccato(p_tabellone uuid, p_livello text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_livello = 'finali'
    or (
      p_livello = 'gold_silver' and exists (
        select 1 from public.tabelloni tb
        where tb.id = p_tabellone and tb.fase_gioco in ('gironi_gold_silver', 'finali')
      )
    )
    or exists (
      select 1 from public.partite p
      join public.gironi g on g.id = p.girone_id
      where p.tabellone_id = p_tabellone
        and public.livello_girone(g.fase) = p_livello
        and p.stato <> 'programmata'
    );
$$;

grant execute on function public.livello_modificabile(uuid) to authenticated;
grant execute on function public.gironi_livello_bloccato(uuid, text) to authenticated;

-- Confirmed players who belong in `p_livello` but are in none of its
-- groups: every confirmed player for the initial level; the players of
-- the initial groups for gold/silver.
create function public.gironi_fuori_livello(p_tabellone uuid, p_livello text)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select i.id
  from public.iscrizioni i
  where i.tabellone_id = p_tabellone
    and i.stato = 'confermata'
    and (
      p_livello = 'iniziale'
      or exists (
        select 1 from public.girone_iscrizioni gi
        join public.gironi g on g.id = gi.girone_id
        where gi.iscrizione_id = i.id
          and g.tabellone_id = p_tabellone
          and gi.livello = case p_livello
            when 'gold_silver' then 'iniziale'
            else 'gold_silver'
          end
      )
    )
    and not exists (
      select 1 from public.girone_iscrizioni gi
      join public.gironi g on g.id = gi.girone_id
      where gi.iscrizione_id = i.id
        and g.tabellone_id = p_tabellone
        and gi.livello = p_livello
    );
$$;

grant execute on function public.gironi_fuori_livello(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Editor (BLVS-28) sul livello modificabile
-- ---------------------------------------------------------------------------

create or replace function public.gironi_prepara_modifica(
  p_tabellone uuid,
  p_versione integer,
  p_gironi uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_versione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select versione_gironi into v_versione
  from public.tabelloni
  where id = p_tabellone
  for update;
  if not found then
    raise exception 'Tabellone non trovato' using errcode = 'no_data_found';
  end if;

  if v_versione <> p_versione then
    raise exception 'I gironi sono cambiati nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = v_versione::text;
  end if;

  if public.gironi_livello_bloccato(
    p_tabellone, public.livello_modificabile(p_tabellone)
  ) then
    raise exception 'Le partite dei gironi sono iniziate: i gironi non si modificano più'
      using errcode = 'check_violation', hint = 'gironi_non_modificabili';
  end if;

  delete from public.partite p
  where p.girone_id = any (p_gironi);
end;
$$;

-- The group of a registration in the editable level (null = not assigned).
create or replace function public.gironi_girone_di(p_tabellone uuid, p_iscrizione uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_girone uuid;
begin
  if not exists (
    select 1 from public.iscrizioni i
    where i.id = p_iscrizione
      and i.tabellone_id = p_tabellone
      and i.stato = 'confermata'
  ) then
    raise exception 'Il giocatore non è un iscritto confermato di questo tabellone'
      using errcode = 'check_violation', hint = 'iscrizione_estranea';
  end if;

  select gi.girone_id into v_girone
  from public.girone_iscrizioni gi
  join public.gironi g on g.id = gi.girone_id
  where gi.iscrizione_id = p_iscrizione
    and g.tabellone_id = p_tabellone
    and gi.livello = public.livello_modificabile(p_tabellone);
  return v_girone;
end;
$$;

create or replace function public.gironi_verifica_girone(p_tabellone uuid, p_girone uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gironi g
    where g.id = p_girone
      and g.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = public.livello_modificabile(p_tabellone)
  ) then
    raise exception 'Girone non trovato in questo tabellone'
      using errcode = 'check_violation', hint = 'girone_estraneo';
  end if;
end;
$$;

create or replace function public.sposta_in_girone(
  p_tabellone uuid,
  p_versione integer,
  p_iscrizione uuid,
  p_girone uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_da uuid;
  v_livello text;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;
  v_livello := public.livello_modificabile(p_tabellone);
  v_da := public.gironi_girone_di(p_tabellone, p_iscrizione);
  if p_girone is not null then
    perform public.gironi_verifica_girone(p_tabellone, p_girone);
  end if;

  perform public.gironi_prepara_modifica(
    p_tabellone, p_versione,
    case when v_da is not distinct from p_girone then array[]::uuid[]
      else array_remove(array[v_da, p_girone], null) end
  );

  if v_da is not distinct from p_girone then
    return p_versione;
  end if;

  delete from public.girone_iscrizioni
  where iscrizione_id = p_iscrizione and livello = v_livello;
  if p_girone is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (p_girone, p_iscrizione);
  end if;
  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

create or replace function public.scambia_in_girone(
  p_tabellone uuid,
  p_versione integer,
  p_a uuid,
  p_b uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ga uuid;
  v_gb uuid;
  v_livello text;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;
  v_livello := public.livello_modificabile(p_tabellone);
  v_ga := public.gironi_girone_di(p_tabellone, p_a);
  v_gb := public.gironi_girone_di(p_tabellone, p_b);

  perform public.gironi_prepara_modifica(
    p_tabellone, p_versione,
    case when v_ga is not distinct from v_gb then array[]::uuid[]
      else array_remove(array[v_ga, v_gb], null) end
  );

  if v_ga is not distinct from v_gb then
    return p_versione;
  end if;

  delete from public.girone_iscrizioni
  where iscrizione_id in (p_a, p_b) and livello = v_livello;
  if v_gb is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (v_gb, p_a);
  end if;
  if v_ga is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (v_ga, p_b);
  end if;
  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

-- «Girone A», «Gold A», «Silver A»…: the first free name with the phase's
-- prefix. Same rule as `prossimoNomeGirone()` in
-- src/lib/gironi/editor/operazioni.ts.
create function public.prossimo_nome_girone(p_tabellone uuid, p_fase text)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_prefisso text := case p_fase
    when 'gold' then 'Gold'
    when 'silver' then 'Silver'
    else 'Girone'
  end;
  v_nome text;
  v_i integer := 0;
begin
  loop
    v_nome := case
      when v_i < 26 then v_prefisso || ' ' || chr(65 + v_i)
      else v_prefisso || ' ' || (v_i + 1)::text
    end;
    exit when not exists (
      select 1 from public.gironi g
      where g.tabellone_id = p_tabellone and g.nome = v_nome
    );
    v_i := v_i + 1;
  end loop;
  return v_nome;
end;
$$;

grant execute on function public.prossimo_nome_girone(uuid, text) to authenticated;

drop function public.aggiungi_girone(uuid, integer);

-- Adds an empty group of `p_fase` (default: the first phase of the
-- editable level) in the last position.
create function public.aggiungi_girone(
  p_tabellone uuid,
  p_versione integer,
  p_fase text default null
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_livello text;
  v_fase text;
begin
  perform public.gironi_prepara_modifica(p_tabellone, p_versione, array[]::uuid[]);

  v_livello := public.livello_modificabile(p_tabellone);
  v_fase := coalesce(
    p_fase,
    case v_livello when 'gold_silver' then 'gold' else 'iniziale' end
  );
  if v_fase not in ('iniziale', 'gold', 'silver')
    or public.livello_girone(v_fase) <> v_livello then
    raise exception 'Questa fase non si modifica nell''editor'
      using errcode = 'check_violation', hint = 'fase_non_valida';
  end if;

  insert into public.gironi (tabellone_id, nome, posizione, fase)
  select p_tabellone,
    public.prossimo_nome_girone(p_tabellone, v_fase),
    coalesce(max(g.posizione), 0) + 1,
    v_fase
  from public.gironi g
  where g.tabellone_id = p_tabellone;

  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

revoke all on function public.aggiungi_girone(uuid, integer, text) from public, anon;
grant execute on function public.aggiungi_girone(uuid, integer, text) to authenticated;

-- The editable level of a board: its groups (each with its phase), the
-- players that belong in it but are in none of its groups, the version
-- and whether the level is locked.
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
              jsonb_build_object('iscrizione_id', i.id, 'nome', public.gironi_nome_giocatore(u))
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
        jsonb_build_object('iscrizione_id', i.id, 'nome', public.gironi_nome_giocatore(u))
        order by u.cognome, u.nome, i.id
      )
      from public.iscrizioni i
      join public.utenti u on u.id = i.utente_id
      where i.id in (select public.gironi_fuori_livello(p_tabellone, v_livello))
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Controlli e avvio (BLVS-29) sul livello modificabile
-- ---------------------------------------------------------------------------

create or replace function public.controlli_avvio_fase(p_tabellone uuid)
returns table (
  regola text,
  girone_id uuid,
  girone_nome text,
  dettaglio text
)
language plpgsql
stable
security invoker
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

-- Every match of the groups of `p_livello` is concluded (a voided one
-- doesn't count) and there is at least one.
create function public.livello_concluso(p_tabellone uuid, p_livello text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.partite p
    join public.gironi g on g.id = p.girone_id
    where p.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = p_livello
  ) and not exists (
    select 1 from public.partite p
    join public.gironi g on g.id = p.girone_id
    where p.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = p_livello
      and p.stato not in ('conclusa', 'annullata')
  );
$$;

grant execute on function public.livello_concluso(uuid, text) to authenticated;

-- The 3 King/Queen matches of a group (same rotation as BLVS-29).
create function public.crea_partite_girone(
  p_tabellone uuid,
  p_girone uuid,
  p_fase_partita text
)
returns table (partita_id uuid, turno integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partita uuid;
  v_turno integer;
begin
  for v_turno in 1 .. 3 loop
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
    where r.turno = v_turno;

    partita_id := v_partita;
    turno := v_turno;
    return next;
  end loop;
end;
$$;

revoke all on function public.crea_partite_girone(uuid, uuid, text) from public, anon;
grant execute on function public.crea_partite_girone(uuid, uuid, text) to authenticated;

-- Starts the editable level: the initial groups (BLVS-29, unchanged
-- rules), or the gold/silver groups once the initial ones are concluded.
create or replace function public.avvia_fase(p_tabellone uuid)
returns table (
  partita_id uuid,
  girone_id uuid,
  girone_nome text,
  turno integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tappa uuid;
  v_stato public.stato_tappa;
  v_fase text;
  v_livello text;
  v_nuova text;
  v_problemi jsonb;
  v_girone record;
  v_partita record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  select tb.tappa_id, tb.fase_gioco into v_tappa, v_fase
  from public.tabelloni tb
  where tb.id = p_tabellone
  for update;

  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  select t.stato into v_stato from public.tappe t where t.id = v_tappa;
  v_livello := public.livello_modificabile(p_tabellone);

  if v_fase is null then
    v_nuova := 'gironi_iniziali';
  elsif v_fase = 'gironi_iniziali' and v_livello = 'gold_silver' then
    v_nuova := 'gironi_gold_silver';
  else
    raise exception 'La fase di questo tabellone è già avviata'
      using errcode = 'check_violation', hint = 'fase_gia_avviata';
  end if;

  if v_stato not in ('iscrizioni_chiuse', 'in_corso')
    or (v_nuova <> 'gironi_iniziali' and v_stato <> 'in_corso') then
    raise exception 'La fase si avvia solo a iscrizioni chiuse'
      using errcode = 'check_violation', hint = 'tappa_non_avviabile';
  end if;

  if v_nuova = 'gironi_gold_silver'
    and not public.livello_concluso(p_tabellone, 'iniziale') then
    raise exception 'I gironi iniziali non sono ancora conclusi'
      using errcode = 'check_violation', hint = 'gironi_non_conclusi';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'regola', c.regola,
        'girone_id', c.girone_id,
        'girone_nome', c.girone_nome,
        'dettaglio', c.dettaglio
      )
    ),
    '[]'::jsonb
  )
  into v_problemi
  from public.controlli_avvio_fase(p_tabellone) c;

  if jsonb_array_length(v_problemi) > 0 then
    raise exception 'La fase non può partire: correggi i gironi'
      using errcode = 'check_violation',
        hint = 'avvio_bloccato',
        detail = v_problemi::text;
  end if;

  if exists (
    select 1
    from public.partite p
    join public.gironi g on g.id = p.girone_id
    left join public.punteggi pt on pt.partita_id = p.id
    where p.tabellone_id = p_tabellone
      and p.fase = 'gironi'
      and public.livello_girone(g.fase) = v_livello
      and (p.stato <> 'programmata' or jsonb_array_length(pt.sets) > 0)
  ) then
    raise exception 'Alcune partite dei gironi sono già iniziate'
      using errcode = 'check_violation', hint = 'partite_iniziate';
  end if;

  -- Only the matches of this level are recreated: the initial ones stay
  -- when the gold/silver groups start.
  delete from public.partite p
  using public.gironi g
  where g.id = p.girone_id
    and p.tabellone_id = p_tabellone
    and p.fase = 'gironi'
    and public.livello_girone(g.fase) = v_livello;
  if v_livello = 'iniziale' then
    delete from public.partite p
    where p.tabellone_id = p_tabellone and p.fase = 'gironi' and p.girone_id is null;
  end if;

  for v_girone in
    select g.id, g.nome
    from public.gironi g
    where g.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = v_livello
    order by g.posizione, g.nome
  loop
    for v_partita in
      select * from public.crea_partite_girone(p_tabellone, v_girone.id, 'gironi')
    loop
      partita_id := v_partita.partita_id;
      girone_id := v_girone.id;
      girone_nome := v_girone.nome;
      turno := v_partita.turno;
      return next;
    end loop;
  end loop;

  update public.tabelloni
  set fase_gioco = v_nuova, fase_avviata_il = now()
  where id = p_tabellone;

  update public.tappe
  set stato = 'in_corso'
  where id = v_tappa and stato = 'iscrizioni_chiuse';
end;
$$;

-- ---------------------------------------------------------------------------
-- Proposta gold/silver
-- ---------------------------------------------------------------------------

-- Replaces the gold/silver proposal of a board with `p_gironi`
-- ([{fase: 'gold'|'silver', iscrizioni: [uuid…]}…], computed by
-- `proponiGoldSilver()` in TS from the standings). Returns the new version
-- of the groups. Refuses with 23514:
--   fase_non_proponibile  the board is not in «gironi iniziali»
--   gironi_non_conclusi   an initial group match is not concluded
--   proposta_non_valida   a phase or a player that doesn't come from an
--                         initial group of the board, or a player twice
create function public.proponi_gironi_gold_silver(
  p_tabellone uuid,
  p_gironi jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fase text;
  v_stato public.stato_tappa;
  v_girone jsonb;
  v_id uuid;
  v_iscrizione text;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può proporre i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select tb.fase_gioco, t.stato into v_fase, v_stato
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where tb.id = p_tabellone
  for update of tb;
  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  if v_stato = 'archiviata' then
    raise exception 'La tappa è archiviata'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_fase is distinct from 'gironi_iniziali' then
    raise exception 'I gironi gold e silver si propongono dopo i gironi iniziali'
      using errcode = 'check_violation', hint = 'fase_non_proponibile';
  end if;
  if not public.livello_concluso(p_tabellone, 'iniziale') then
    raise exception 'I gironi iniziali non sono ancora conclusi'
      using errcode = 'check_violation', hint = 'gironi_non_conclusi';
  end if;

  if jsonb_typeof(p_gironi) <> 'array' or jsonb_array_length(p_gironi) = 0 then
    raise exception 'Proposta vuota'
      using errcode = 'check_violation', hint = 'proposta_non_valida';
  end if;

  -- An earlier proposal (never started) is replaced.
  delete from public.gironi g
  where g.tabellone_id = p_tabellone and g.fase in ('gold', 'silver');

  for v_girone in select * from jsonb_array_elements(p_gironi) loop
    if v_girone ->> 'fase' not in ('gold', 'silver') then
      raise exception 'Fase non valida'
        using errcode = 'check_violation', hint = 'proposta_non_valida';
    end if;

    insert into public.gironi (tabellone_id, nome, posizione, fase)
    select p_tabellone,
      public.prossimo_nome_girone(p_tabellone, v_girone ->> 'fase'),
      coalesce(max(g.posizione), 0) + 1,
      v_girone ->> 'fase'
    from public.gironi g
    where g.tabellone_id = p_tabellone
    returning id into v_id;

    for v_iscrizione in
      select * from jsonb_array_elements_text(v_girone -> 'iscrizioni')
    loop
      if not exists (
        select 1 from public.girone_iscrizioni gi
        join public.gironi g on g.id = gi.girone_id
        join public.iscrizioni i on i.id = gi.iscrizione_id
        where gi.iscrizione_id = v_iscrizione::uuid
          and g.tabellone_id = p_tabellone
          and g.fase = 'iniziale'
          and i.stato = 'confermata'
      ) then
        raise exception 'Il giocatore non arriva dai gironi iniziali'
          using errcode = 'check_violation', hint = 'proposta_non_valida';
      end if;
      begin
        insert into public.girone_iscrizioni (girone_id, iscrizione_id)
        values (v_id, v_iscrizione::uuid);
      exception when unique_violation then
        raise exception 'Lo stesso giocatore compare due volte'
          using errcode = 'check_violation', hint = 'proposta_non_valida';
      end;
    end loop;
  end loop;

  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

revoke all on function public.proponi_gironi_gold_silver(uuid, jsonb) from public, anon;
grant execute on function public.proponi_gironi_gold_silver(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Finali
-- ---------------------------------------------------------------------------

-- Creates the gold final and the silver final of a board
-- (`p_finali` = [{fase: 'finale_gold'|'finale_silver', iscrizioni: […]}],
-- computed by `generaFinali()` in TS), each a King/Queen group with its 3
-- matches (`partite.fase = 'finale'`), and moves the board to «finali».
-- Refuses with 23514:
--   finali_gia_generate   the finals exist
--   fase_non_proponibile  the gold/silver groups are not started
--   gironi_non_conclusi   a gold/silver match is not concluded
--   finale_non_valida     wrong size, or a player not from a group of the
--                         same colour
create function public.genera_finali(p_tabellone uuid, p_finali jsonb)
returns table (
  partita_id uuid,
  girone_id uuid,
  girone_nome text,
  turno integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_fase text;
  v_stato public.stato_tappa;
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

  select tb.fase_gioco, t.stato into v_fase, v_stato
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

revoke all on function public.genera_finali(uuid, jsonb) from public, anon;
grant execute on function public.genera_finali(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Rigenerazione (BLVS-30): solo finché esistono solo i gironi iniziali
-- ---------------------------------------------------------------------------

alter function public.rigenera_gironi(uuid, boolean, integer)
  rename to rigenera_gironi_iniziali;

create function public.rigenera_gironi(
  p_tabellone uuid,
  p_conferma boolean default false,
  p_attesi integer default 0
)
returns table (
  categoria public.categoria,
  gironi integer,
  partite integer,
  esclusi jsonb,
  punteggi_persi integer,
  registro_id bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.gironi g
    where g.tabellone_id = p_tabellone and g.fase <> 'iniziale'
  ) then
    raise exception 'I gironi gold e silver esistono già: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'fase_successiva';
  end if;
  return query
  select * from public.rigenera_gironi_iniziali(p_tabellone, p_conferma, p_attesi);
end;
$$;

revoke all on function public.rigenera_gironi_iniziali(uuid, boolean, integer) from public, anon;
grant execute on function public.rigenera_gironi_iniziali(uuid, boolean, integer) to authenticated;
revoke all on function public.rigenera_gironi(uuid, boolean, integer) from public, anon;
grant execute on function public.rigenera_gironi(uuid, boolean, integer) to authenticated;
