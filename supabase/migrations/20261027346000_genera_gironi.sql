-- BLVS-26 · Generazione dei gironi e delle partite (R-23, R-26).
--
-- A iscrizioni chiuse l'admin genera, per ogni tabellone (M e F), gironi da 4
-- con un sorteggio tra le iscrizioni confermate. Ogni girone gioca le tre
-- partite del formato King/Queen, così ognuno fa coppia una volta con
-- ciascuno degli altri tre e li affronta due volte:
--   turno 1: A+B contro C+D
--   turno 2: A+C contro B+D
--   turno 3: A+D contro B+C
-- Chi non completa un girone (iscritti non multipli di 4) è sorteggiato fuori
-- e solo segnalato: la sua iscrizione resta com'è.
-- TODO(Q-05): regola provvisoria (esclusi a caso, solo segnalati), da
-- confermare col cliente. Mirror in TS: src/lib/gironi/generazione/.
--
-- Una nuova chiamata rigenera tutto finché nessuna partita della tappa è
-- iniziata (stato diverso da `programmata` o un set già inserito).

create function public.genera_gironi(p_tappa uuid)
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

  -- Rigenerazione: via gironi e partite dei gironi (a cascata giocatori e
  -- punteggi), poi il nuovo sorteggio.
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
    -- Il sorteggio: un ordine casuale decide gironi, posizioni ed esclusi.
    select coalesce(array_agg(i.id order by random()), array[]::uuid[])
    into v_iscritti
    from public.iscrizioni i
    where i.tabellone_id = v_tabellone.id and i.stato = 'confermata';

    v_n := cardinality(v_iscritti);
    v_completi := v_n / 4;
    v_esclusi := v_iscritti[v_completi * 4 + 1 : v_n];

    for g in 1 .. v_completi loop
      insert into public.gironi (tabellone_id, nome, posizione)
      values (
        v_tabellone.id,
        'Girone ' || case when g <= 26 then chr(64 + g) else g::text end,
        g
      )
      returning id into v_girone;

      insert into public.girone_iscrizioni (girone_id, iscrizione_id)
      select v_girone, v_iscritti[(g - 1) * 4 + k]
      from generate_series(1, 4) as k;

      for v_turno in 1 .. 3 loop
        insert into public.partite (tabellone_id, girone_id, fase, turno)
        values (v_tabellone.id, v_girone, 'gironi', v_turno)
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

    categoria := v_tabellone.categoria;
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
  end loop;
end;
$$;

revoke all on function public.genera_gironi(uuid) from public, anon;
grant execute on function public.genera_gironi(uuid) to authenticated;
