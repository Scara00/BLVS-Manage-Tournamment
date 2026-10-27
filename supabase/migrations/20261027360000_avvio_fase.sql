-- BLVS-29 · Avvio di una fase (R-09, R-25, R-26).
--
-- Per ogni tabellone (M o F, separatamente) l'admin avvia la fase «gironi
-- iniziali» quando i gironi sono composti (BLVS-26 sorteggio, BLVS-28
-- editor). Il server rifiuta l'avvio se:
--   girone_non_da_4  un girone non ha esattamente 4 giocatori confermati;
--   doppione         lo stesso giocatore sta in più gironi del tabellone;
--   non_assegnato    un iscritto confermato non è in nessun girone;
--   nessun_girone    il tabellone non ha gironi.
-- Le eccezioni configurabili (Q-05) sono in `public.regola_avvio()`, mirror
-- di `REGOLA_AVVIO` in src/lib/tappe/avvio/regole.ts: cambiale insieme.
--
-- L'avvio (ri)crea le 3 partite King/Queen di ogni girone, «da giocare»
-- (stato `programmata`), dalla composizione attuale dei gironi:
--   turno 1: A+B contro C+D
--   turno 2: A+C contro B+D
--   turno 3: A+D contro B+C
-- poi porta il tabellone a `fase_gioco = 'gironi_iniziali'` e la tappa da
-- `iscrizioni_chiuse` a `in_corso`.

alter table public.tabelloni
  add column if not exists fase_gioco text
    constraint tabelloni_fase_gioco check (fase_gioco in ('gironi_iniziali')),
  add column if not exists fase_avviata_il timestamptz;

comment on column public.tabelloni.fase_gioco is
  'Fase di gioco avviata (BLVS-29): null finché non parte, poi gironi_iniziali. Non è la fase gold/silver.';

-- ---------------------------------------------------------------------------
-- Regola di avvio (Q-05)
-- ---------------------------------------------------------------------------

-- TODO(Q-05): da confermare col cliente. `ammetti_resto` = true lascia
-- avviare con meno di `dimensione` iscritti fuori dai gironi (chi avanza dal
-- sorteggio di BLVS-26).
create function public.regola_avvio()
returns table (dimensione integer, ammetti_resto boolean)
language sql
immutable
set search_path = ''
as $$
  select 4, false;
$$;

grant execute on function public.regola_avvio() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lettere dei giocatori di un girone
-- ---------------------------------------------------------------------------

-- A, B, C, D… nell'ordine del posto in tabellone, poi cognome e nome. È
-- l'unico punto che decide le lettere: se l'editor dei gironi (BLVS-28)
-- introduce una posizione nel girone, ridefinisci solo questa funzione.
-- Solo le iscrizioni confermate giocano.
create function public.giocatori_girone(p_girone uuid)
returns table (
  lettera text,
  iscrizione_id uuid,
  utente_id uuid,
  nome text,
  cognome text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    chr(64 + (row_number() over (
      order by i.posto nulls last, u.cognome, u.nome, i.id
    ))::integer),
    i.id,
    u.id,
    u.nome,
    u.cognome
  from public.girone_iscrizioni gi
  join public.iscrizioni i on i.id = gi.iscrizione_id
  join public.utenti u on u.id = i.utente_id
  where gi.girone_id = p_girone and i.stato = 'confermata'
  order by i.posto nulls last, u.cognome, u.nome, i.id;
$$;

grant execute on function public.giocatori_girone(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Controlli
-- ---------------------------------------------------------------------------

create function public.controlli_avvio_fase(p_tabellone uuid)
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
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_regola from public.regola_avvio();

  if not exists (
    select 1 from public.gironi g where g.tabellone_id = p_tabellone
  ) then
    regola := 'nessun_girone';
    girone_id := null;
    girone_nome := null;
    dettaglio := null;
    return next;
  end if;

  -- Gironi con un numero di giocatori confermati diverso da quello previsto.
  return query
  select 'girone_non_da_4'::text, g.id, g.nome, count(i.id)::text
  from public.gironi g
  left join public.girone_iscrizioni gi on gi.girone_id = g.id
  left join public.iscrizioni i
    on i.id = gi.iscrizione_id and i.stato = 'confermata'
  where g.tabellone_id = p_tabellone
  group by g.id, g.nome, g.posizione
  having count(i.id) <> v_regola.dimensione
  order by g.posizione, g.nome;

  -- Lo stesso giocatore in più gironi del tabellone: una riga per girone.
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
    and i.utente_id in (
      select i2.utente_id
      from public.gironi g2
      join public.girone_iscrizioni gi2 on gi2.girone_id = g2.id
      join public.iscrizioni i2 on i2.id = gi2.iscrizione_id
      where g2.tabellone_id = p_tabellone
      group by i2.utente_id
      having count(*) > 1
    )
  order by g.posizione, g.nome, u.cognome, u.nome;

  -- Iscritti confermati che non stanno in nessun girone del tabellone.
  return query
  with fuori as (
    select i.id, u.cognome, u.nome
    from public.iscrizioni i
    join public.utenti u on u.id = i.utente_id
    where i.tabellone_id = p_tabellone
      and i.stato = 'confermata'
      and not exists (
        select 1
        from public.girone_iscrizioni gi
        join public.gironi g on g.id = gi.girone_id
        where gi.iscrizione_id = i.id and g.tabellone_id = p_tabellone
      )
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

revoke all on function public.controlli_avvio_fase(uuid) from public, anon;
grant execute on function public.controlli_avvio_fase(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Avvio
-- ---------------------------------------------------------------------------

create function public.avvia_fase(p_tabellone uuid)
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
  v_problemi jsonb;
  v_girone record;
  v_partita uuid;
  v_turno integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  -- Due avvii contemporanei dello stesso tabellone si mettono in coda qui.
  select tb.tappa_id, tb.fase_gioco into v_tappa, v_fase
  from public.tabelloni tb
  where tb.id = p_tabellone
  for update;

  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  select t.stato into v_stato from public.tappe t where t.id = v_tappa;

  if v_fase is not null then
    raise exception 'La fase di questo tabellone è già avviata'
      using errcode = 'check_violation', hint = 'fase_gia_avviata';
  end if;

  if v_stato not in ('iscrizioni_chiuse', 'in_corso') then
    raise exception 'La fase si avvia solo a iscrizioni chiuse'
      using errcode = 'check_violation', hint = 'tappa_non_avviabile';
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
    left join public.punteggi pt on pt.partita_id = p.id
    where p.tabellone_id = p_tabellone
      and p.fase = 'gironi'
      and (p.stato <> 'programmata' or jsonb_array_length(pt.sets) > 0)
  ) then
    raise exception 'Alcune partite dei gironi sono già iniziate'
      using errcode = 'check_violation', hint = 'partite_iniziate';
  end if;

  -- Le partite di un sorteggio precedente (BLVS-26) potrebbero non seguire
  -- più i gironi modificati a mano: si ricreano tutte dalla composizione
  -- attuale.
  delete from public.partite p
  where p.tabellone_id = p_tabellone and p.fase = 'gironi';

  for v_girone in
    select g.id, g.nome
    from public.gironi g
    where g.tabellone_id = p_tabellone
    order by g.posizione, g.nome
  loop
    for v_turno in 1 .. 3 loop
      insert into public.partite (tabellone_id, girone_id, fase, turno, stato)
      values (p_tabellone, v_girone.id, 'gironi', v_turno, 'programmata')
      returning id into v_partita;

      insert into public.partita_giocatori (partita_id, iscrizione_id, squadra)
      select v_partita, gg.iscrizione_id, r.squadra
      from (
        values
          (1, 'A', 'A'), (1, 'B', 'A'), (1, 'C', 'B'), (1, 'D', 'B'),
          (2, 'A', 'A'), (2, 'C', 'A'), (2, 'B', 'B'), (2, 'D', 'B'),
          (3, 'A', 'A'), (3, 'D', 'A'), (3, 'B', 'B'), (3, 'C', 'B')
      ) as r (turno, lettera, squadra)
      join public.giocatori_girone(v_girone.id) gg on gg.lettera = r.lettera
      where r.turno = v_turno;

      partita_id := v_partita;
      girone_id := v_girone.id;
      girone_nome := v_girone.nome;
      turno := v_turno;
      return next;
    end loop;
  end loop;

  update public.tabelloni
  set fase_gioco = 'gironi_iniziali', fase_avviata_il = now()
  where id = p_tabellone;

  update public.tappe
  set stato = 'in_corso'
  where id = v_tappa and stato = 'iscrizioni_chiuse';
end;
$$;

revoke all on function public.avvia_fase(uuid) from public, anon;
grant execute on function public.avvia_fase(uuid) to authenticated;
