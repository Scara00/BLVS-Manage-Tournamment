-- Tappa King & Queen mista: gironi da 4 uomini + 4 donne.
--
-- Prima (20261102100100_tappa_mista.sql) un girone misto era 2 uomini + 2
-- donne con 2 partite. Ora, per decisione del cliente (08/11/2026):
-- - ogni girone misto (iniziale, gold, silver e le due finali) è da 8:
--   4 uomini (lettere A-D) + 4 donne (E-H);
-- - 8 partite in 4 turni da 2 partite in contemporanea: ogni uomo gioca una
--   volta con ogni donna e affronta tutti gli altri uomini
--   (`rotazione_girone()`);
-- - in gold vanno i 2 migliori uomini e le 2 migliori donne di ogni girone,
--   in silver gli altri 2 + 2 (lo decide l'app:
--   src/lib/gironi/fasi/qualificazione.ts);
-- - il massimo di una tappa mista è un multiplo di 8 (metà uomini, metà
--   donne), così a tabellone pieno nessuno resta fuori dai gironi.
-- Il formato classico non cambia: gironi da 4 con 3 partite, una per turno.
-- TS: `GIRONE_MISTO` e `POSTI_MISTO_MULTIPLO` in src/lib/tappe/formato.ts.

-- ---------------------------------------------------------------------------
-- Partite di un girone
-- ---------------------------------------------------------------------------

-- Le partite di un girone per lettera: `partita` è il numero della partita,
-- `turno` il turno in cui si gioca (nel misto 2 partite per turno).
create function public.rotazione_girone(p_misto boolean)
returns table (partita integer, turno integer, lettera text, squadra text)
language sql
immutable
set search_path = ''
as $$
  select r.partita, r.turno, r.lettera, r.squadra
  from (
    values
      -- Classico: A+B|C+D, A+C|B+D, A+D|B+C.
      (false, 1, 1, 'A', 'A'), (false, 1, 1, 'B', 'A'),
      (false, 1, 1, 'C', 'B'), (false, 1, 1, 'D', 'B'),
      (false, 2, 2, 'A', 'A'), (false, 2, 2, 'C', 'A'),
      (false, 2, 2, 'B', 'B'), (false, 2, 2, 'D', 'B'),
      (false, 3, 3, 'A', 'A'), (false, 3, 3, 'D', 'A'),
      (false, 3, 3, 'B', 'B'), (false, 3, 3, 'C', 'B'),
      -- Misto: uomini A-D, donne E-H.
      -- Turno 1: A+E|B+F, C+G|D+H.
      (true, 1, 1, 'A', 'A'), (true, 1, 1, 'E', 'A'),
      (true, 1, 1, 'B', 'B'), (true, 1, 1, 'F', 'B'),
      (true, 2, 1, 'C', 'A'), (true, 2, 1, 'G', 'A'),
      (true, 2, 1, 'D', 'B'), (true, 2, 1, 'H', 'B'),
      -- Turno 2: A+F|C+H, B+G|D+E.
      (true, 3, 2, 'A', 'A'), (true, 3, 2, 'F', 'A'),
      (true, 3, 2, 'C', 'B'), (true, 3, 2, 'H', 'B'),
      (true, 4, 2, 'B', 'A'), (true, 4, 2, 'G', 'A'),
      (true, 4, 2, 'D', 'B'), (true, 4, 2, 'E', 'B'),
      -- Turno 3: A+G|D+F, B+H|C+E.
      (true, 5, 3, 'A', 'A'), (true, 5, 3, 'G', 'A'),
      (true, 5, 3, 'D', 'B'), (true, 5, 3, 'F', 'B'),
      (true, 6, 3, 'B', 'A'), (true, 6, 3, 'H', 'A'),
      (true, 6, 3, 'C', 'B'), (true, 6, 3, 'E', 'B'),
      -- Turno 4: A+H|B+E, C+F|D+G.
      (true, 7, 4, 'A', 'A'), (true, 7, 4, 'H', 'A'),
      (true, 7, 4, 'B', 'B'), (true, 7, 4, 'E', 'B'),
      (true, 8, 4, 'C', 'A'), (true, 8, 4, 'F', 'A'),
      (true, 8, 4, 'D', 'B'), (true, 8, 4, 'G', 'B')
  ) as r (misto, partita, turno, lettera, squadra)
  where r.misto = p_misto
  order by r.partita, r.squadra, r.lettera;
$$;

revoke all on function public.rotazione_girone(boolean) from public;
grant execute on function public.rotazione_girone(boolean) to anon, authenticated;

-- Come prima, ma le partite vengono da `rotazione_girone()`: nel misto 8
-- partite in 4 turni.
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
  v_misto boolean;
  v_numero integer;
  v_turno integer;
  v_partita uuid;
begin
  select tb.categoria = 'X' into v_misto
  from public.tabelloni tb
  where tb.id = p_tabellone;

  for v_numero, v_turno in
    select distinct r.partita, r.turno
    from public.rotazione_girone(coalesce(v_misto, false)) r
    order by r.partita
  loop
    insert into public.partite (tabellone_id, girone_id, fase, turno, stato)
    values (p_tabellone, p_girone, p_fase_partita, v_turno, 'programmata')
    returning id into v_partita;

    insert into public.partita_giocatori (partita_id, iscrizione_id, squadra)
    select v_partita, gg.iscrizione_id, r.squadra
    from public.rotazione_girone(coalesce(v_misto, false)) r
    join public.giocatori_girone(p_girone) gg on gg.lettera = r.lettera
    where r.partita = v_numero;

    partita_id := v_partita;
    turno := v_turno;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sorteggio
-- ---------------------------------------------------------------------------

-- Uomini e donne mescolati a parte, ogni girone ne prende 4 + 4. Chi resta
-- senza girone è solo segnalato.
create or replace function public.sorteggia_gironi_misto(p_tabellone uuid)
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

  v_completi := least(cardinality(v_m), cardinality(v_f)) / 4;
  v_esclusi := v_m[v_completi * 4 + 1 : cardinality(v_m)]
    || v_f[v_completi * 4 + 1 : cardinality(v_f)];

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
    from unnest(v_m[4 * g - 3 : 4 * g] || v_f[4 * g - 3 : 4 * g]) as x;

    perform public.crea_partite_girone(p_tabellone, v_girone, 'gironi');
  end loop;

  gironi := v_completi;
  partite := v_completi * 8;
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

-- ---------------------------------------------------------------------------
-- Controlli prima dell'avvio
-- ---------------------------------------------------------------------------

-- Come prima, ma nel misto un girone è da 8 = 4 uomini + 4 donne
-- (`girone_non_da_4` resta il nome della regola: dettaglio = giocatori).
create or replace function public.controlli_avvio_fase(p_tabellone uuid)
returns table (regola text, girone_id uuid, girone_nome text, dettaglio text)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_regola record;
  v_livello text;
  v_misto boolean;
  v_dimensione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_regola from public.regola_avvio();
  v_livello := public.livello_modificabile(p_tabellone);
  select tb.categoria = 'X' into v_misto
  from public.tabelloni tb
  where tb.id = p_tabellone;
  v_dimensione := case when v_misto then 8 else v_regola.dimensione end;

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
  having count(i.id) <> v_dimensione
  order by g.posizione, g.nome;

  if v_misto then
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
    having count(*) = v_dimensione
      and count(*) filter (where u.categoria = 'M') <> v_dimensione / 2
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
    and (select count(*) from fuori) < v_dimensione
  )
  order by f.cognome, f.nome;
end;
$$;

-- ---------------------------------------------------------------------------
-- Finali
-- ---------------------------------------------------------------------------

-- Come prima, ma nel misto una finale è da 8 = 4 uomini + 4 donne.
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

  if v_misto then
    v_giocatori := 8;
  else
    select r.giocatori into v_giocatori from public.regola_finali() r;
  end if;

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

-- ---------------------------------------------------------------------------
-- Massimo della tappa mista: multiplo di 8
-- ---------------------------------------------------------------------------

-- Come prima, ma il massimo è un multiplo di 8, da 8 a 256.
create or replace function public.crea_tappa_mista(
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

  if p_posti is null or p_posti not between 8 and 256 then
    raise exception 'Il tabellone misto ha tra 8 e 256 posti'
      using errcode = 'check_violation', hint = 'posti';
  end if;

  if p_posti % 8 <> 0 then
    raise exception 'Nel misto i posti sono un multiplo di 8: gironi da 4 uomini e 4 donne'
      using errcode = 'check_violation', hint = 'posti_misto';
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

-- Come prima, ma nel misto il nuovo massimo è un multiplo di 8. Un massimo
-- già salvato che non lo è resta finché non lo si cambia.
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
    if new.posti % 8 <> 0 then
      raise exception 'Nel misto i posti sono un multiplo di 8: gironi da 4 uomini e 4 donne'
        using errcode = 'check_violation', hint = 'posti_misto';
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
