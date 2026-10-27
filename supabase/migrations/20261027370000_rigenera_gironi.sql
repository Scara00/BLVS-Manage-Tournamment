-- BLVS-30 · Rigenerazione dei gironi (R-27, R-35).
--
-- L'admin rigenera i gironi di UN tabellone (M o F). Senza punteggi la
-- rigenerazione è diretta; con punteggi già inseriti nelle partite dei
-- gironi serve una conferma esplicita, e i punteggi si perdono. Ogni
-- rigenerazione scrive un evento `rigenerazione_gironi` nel registro di
-- BLVS-08 con il numero di punteggi persi (e i punteggi stessi, per chi
-- deve ricostruire la storia).
--
-- Il sorteggio è quello di BLVS-26: qui lo si estrae in una funzione per
-- tabellone, `sorteggia_gironi_tabellone()`, e `genera_gironi()` la usa.

-- ---------------------------------------------------------------------------
-- Sorteggio di un tabellone (estratto da genera_gironi di BLVS-26)
-- ---------------------------------------------------------------------------

-- Disegna i gironi da 4 delle iscrizioni confermate di un tabellone e crea
-- le 3 partite King/Queen di ciascun girone. Non cancella nulla e non
-- controlla stati: lo fanno le funzioni che la chiamano.
create function public.sorteggia_gironi_tabellone(p_tabellone uuid)
returns table (gironi integer, partite integer, esclusi jsonb)
language plpgsql
security invoker
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

revoke all on function public.sorteggia_gironi_tabellone(uuid) from public, anon;
grant execute on function public.sorteggia_gironi_tabellone(uuid) to authenticated;

-- genera_gironi di BLVS-26, identica nelle regole, ora sul sorteggio comune.
create or replace function public.genera_gironi(p_tappa uuid)
returns table (
  categoria public.categoria,
  gironi integer,
  partite integer,
  esclusi jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
  v_tabellone record;
  v_esito record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può generare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select t.stato into v_stato
  from public.tappe t
  where t.id = p_tappa
  for update;

  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;

  if v_stato <> 'iscrizioni_chiuse' then
    raise exception 'I gironi si generano solo a iscrizioni chiuse'
      using errcode = 'check_violation', hint = 'iscrizioni_non_chiuse';
  end if;

  if exists (
    select 1
    from public.partite p
    join public.tabelloni tb on tb.id = p.tabellone_id
    left join public.punteggi pt on pt.partita_id = p.id
    where tb.tappa_id = p_tappa
      and (p.stato <> 'programmata' or jsonb_array_length(pt.sets) > 0)
  ) then
    raise exception 'Le partite sono già iniziate: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'partite_iniziate';
  end if;

  delete from public.partite p
  using public.tabelloni tb
  where tb.id = p.tabellone_id and tb.tappa_id = p_tappa and p.fase = 'gironi';
  delete from public.gironi g
  using public.tabelloni tb
  where tb.id = g.tabellone_id and tb.tappa_id = p_tappa;

  for v_tabellone in
    select tb.id, tb.categoria
    from public.tabelloni tb
    where tb.tappa_id = p_tappa
    order by tb.categoria
  loop
    select * into v_esito
    from public.sorteggia_gironi_tabellone(v_tabellone.id);
    categoria := v_tabellone.categoria;
    gironi := v_esito.gironi;
    partite := v_esito.partite;
    esclusi := v_esito.esclusi;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Punteggi che una rigenerazione farebbe perdere
-- ---------------------------------------------------------------------------

-- Un punteggio «si perde» quando una partita della fase a gironi del
-- tabellone ha almeno un set inserito (decisione del cliente: le partite di
-- eliminazione e finale non contano, e una rigenerazione con quelle fasi già
-- create è comunque rifiutata). È l'unica fonte di «quanti e quali».
create function public.punteggi_rigenerazione(p_tabellone uuid)
returns table (
  partita_id uuid,
  girone text,
  girone_posizione integer,
  turno integer,
  stato public.stato_partita,
  sets jsonb,
  squadra_a text[],
  squadra_b text[]
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può rigenerare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    g.nome,
    g.posizione,
    p.turno,
    p.stato,
    pt.sets,
    coalesce(
      array_agg(u.nome || ' ' || u.cognome order by u.cognome, u.nome)
        filter (where pg.squadra = 'A'),
      array[]::text[]
    ),
    coalesce(
      array_agg(u.nome || ' ' || u.cognome order by u.cognome, u.nome)
        filter (where pg.squadra = 'B'),
      array[]::text[]
    )
  from public.partite p
  join public.punteggi pt on pt.partita_id = p.id
  left join public.gironi g on g.id = p.girone_id
  left join public.partita_giocatori pg on pg.partita_id = p.id
  left join public.iscrizioni i on i.id = pg.iscrizione_id
  left join public.utenti u on u.id = i.utente_id
  where p.tabellone_id = p_tabellone
    and p.fase = 'gironi'
    and jsonb_array_length(pt.sets) > 0
  group by p.id, g.nome, g.posizione, p.turno, p.stato, pt.sets
  order by g.posizione nulls last, p.turno, p.id;
end;
$$;

revoke all on function public.punteggi_rigenerazione(uuid) from public, anon;
grant execute on function public.punteggi_rigenerazione(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rigenerazione di un tabellone
-- ---------------------------------------------------------------------------

-- p_conferma: l'admin ha spuntato «accetto di perdere i punteggi».
-- p_attesi: quanti punteggi l'admin ha visto nella conferma. Se nel frattempo
-- ne è stato inserito (o tolto) uno, la rigenerazione si ferma (40001
-- `punteggi_cambiati`), così nessun punteggio si perde senza che lo si sia
-- visto.
--
-- Errori (23514 salvo dove indicato), con hint:
--   42501                     non admin
--   P0002                     tabellone non trovato
--   tappa_archiviata          tappa archiviata (consultabile, non modificabile)
--   tappa_non_rigenerabile    tappa non in iscrizioni_chiuse / in_corso
--   tabellone_concluso        risultati del tabellone già chiusi (BLVS-43)
--   fase_successiva           esistono partite di eliminazione o finale
--   conferma_richiesta        ci sono punteggi e manca la conferma (detail = N)
--   40001 punteggi_cambiati   i punteggi sono cambiati (detail = N attuale)
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
declare
  v_tabellone record;
  v_persi integer;
  v_prima jsonb;
  v_esito record;
  v_registro public.registro;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può rigenerare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  -- Lo stesso lock del tabellone usato da iscrizioni e avvio fase: chi
  -- iscrive o avvia aspetta la fine della rigenerazione.
  select tb.id, tb.categoria, tb.concluso_il, t.stato
  into v_tabellone
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where tb.id = p_tabellone
  for update of tb;

  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  if v_tabellone.stato = 'archiviata' then
    raise exception 'La tappa è archiviata: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;

  if v_tabellone.stato not in ('iscrizioni_chiuse', 'in_corso') then
    raise exception 'I gironi si rigenerano a iscrizioni chiuse o a tappa in corso'
      using errcode = 'check_violation', hint = 'tappa_non_rigenerabile';
  end if;

  if v_tabellone.concluso_il is not null then
    raise exception 'Il tabellone è concluso: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'tabellone_concluso';
  end if;

  if exists (
    select 1 from public.partite p
    where p.tabellone_id = p_tabellone and p.fase <> 'gironi'
  ) then
    raise exception 'La fase a eliminazione è già iniziata: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'fase_successiva';
  end if;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'partita_id', r.partita_id,
          'girone', r.girone,
          'turno', r.turno,
          'stato', r.stato,
          'sets', r.sets,
          'squadra_a', to_jsonb(r.squadra_a),
          'squadra_b', to_jsonb(r.squadra_b)
        )
        order by r.girone_posizione nulls last, r.turno
      ),
      '[]'::jsonb
    )
  into v_persi, v_prima
  from public.punteggi_rigenerazione(p_tabellone) r;

  if v_persi > 0 and not coalesce(p_conferma, false) then
    raise exception 'Rigenerare i gironi cancella % punteggi: serve la conferma', v_persi
      using errcode = 'check_violation',
            hint = 'conferma_richiesta',
            detail = v_persi::text;
  end if;

  if v_persi <> coalesce(p_attesi, 0) then
    raise exception 'I punteggi sono cambiati: ora sono %', v_persi
      using errcode = 'serialization_failure',
            hint = 'punteggi_cambiati',
            detail = v_persi::text;
  end if;

  -- Fotografia dei gironi di prima, per il registro.
  v_prima := jsonb_build_object(
    'gironi',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'nome', g.nome,
            'iscrizioni',
            coalesce(
              (
                select jsonb_agg(gi.iscrizione_id order by gi.iscrizione_id)
                from public.girone_iscrizioni gi
                where gi.girone_id = g.id
              ),
              '[]'::jsonb
            )
          )
          order by g.posizione
        )
        from public.gironi g
        where g.tabellone_id = p_tabellone
      ),
      '[]'::jsonb
    ),
    'punteggi_persi', v_persi,
    'punteggi', v_prima
  );

  -- Via le partite dei gironi (a cascata giocatori e punteggi) e i gironi.
  delete from public.partite p
  where p.tabellone_id = p_tabellone and p.fase = 'gironi';
  delete from public.gironi g
  where g.tabellone_id = p_tabellone;

  select * into v_esito
  from public.sorteggia_gironi_tabellone(p_tabellone);

  -- L'editor dei gironi (BLVS-28) aperto altrove vede un conflitto e
  -- ricarica la nuova composizione invece di salvare sulla vecchia.
  update public.tabelloni
  set versione_gironi = versione_gironi + 1
  where id = p_tabellone;

  v_registro := public.registra_evento(
    'rigenerazione_gironi',
    'tabelloni',
    p_tabellone::text,
    v_prima,
    jsonb_build_object(
      'categoria', v_tabellone.categoria,
      'gironi', v_esito.gironi,
      'partite', v_esito.partite,
      'esclusi', v_esito.esclusi,
      'punteggi_persi', v_persi
    ),
    case
      when v_persi = 0 then 'Rigenerazione senza punteggi persi'
      when v_persi = 1 then 'Rigenerazione con 1 punteggio perso'
      else 'Rigenerazione con ' || v_persi || ' punteggi persi'
    end
  );

  categoria := v_tabellone.categoria;
  gironi := v_esito.gironi;
  partite := v_esito.partite;
  esclusi := v_esito.esclusi;
  punteggi_persi := v_persi;
  registro_id := v_registro.id;
  return next;
end;
$$;

revoke all on function public.rigenera_gironi(uuid, boolean, integer)
  from public, anon;
grant execute on function public.rigenera_gironi(uuid, boolean, integer)
  to authenticated;
