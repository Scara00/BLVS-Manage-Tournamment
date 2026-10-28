-- BLVS-54 · Giocatori e cambio di categoria da admin (R-05, R-54).
--
-- - `utenti.categoria_verificata_il`: null = categoria «da verificare».
--   La imposta solo l'admin (verifica o cambio); se il giocatore cambia da
--   sé la categoria torna da verificare.
-- - `effetti_cambio_categoria(utente, categoria)`: cosa sposta un cambio
--   (iscrizioni future con il posto nel nuovo tabellone, gironi lasciati,
--   tappe in corso che lo impediscono). Solo admin, sola lettura.
-- - `admin_cambia_categoria(utente, categoria, attesi, nota)`: il cambio in
--   una transazione. Le iscrizioni attive alle tappe non ancora iniziate
--   passano al tabellone della nuova categoria (primo posto libero, anche
--   oltre il massimo come `admin_iscrivi_giocatore`); un'iscrizione attiva a
--   una tappa in corso lo blocca (decisione del cliente). Scrive
--   `cambio_categoria` nel registro: uno per tappa spostata (con
--   `tappa_id`, così compare nel registro di quella tappa) e uno sul
--   giocatore.
-- - Classifica generale: i punti seguono la categoria ATTUALE del giocatore,
--   in tutte le stagioni (decisione del cliente). Le classifiche di tappa
--   restano sul tabellone in cui si è giocato. `classifica_generale_dati`
--   restituisce ora anche `categoria_attuale` per iscrizione e, in `altro`,
--   gli stessi dati per il tabellone dell'altra categoria.

-- ---------------------------------------------------------------------------
-- Categoria da verificare
-- ---------------------------------------------------------------------------

alter table public.utenti add column if not exists categoria_verificata_il timestamptz;

comment on column public.utenti.categoria_verificata_il is
  'BLVS-54: when an admin confirmed (or set) the category. Null = «da verificare». Reset when the player changes it.';

create index if not exists utenti_da_verificare_idx
  on public.utenti (cognome, nome)
  where categoria_verificata_il is null and anonimizzato_il is null;

-- BEFORE UPDATE, after `utenti_proteggi_campi` (alphabetical order).
create function public.proteggi_verifica_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or current_setting('blvs.cambio_categoria', true) = 'on'
     or public.is_admin() then
    return new;
  end if;

  if new.categoria_verificata_il is distinct from old.categoria_verificata_il then
    raise exception 'Solo un admin può verificare la categoria'
      using errcode = 'insufficient_privilege';
  end if;

  -- Il giocatore cambia da sé la categoria (BLVS-16): torna da verificare.
  if new.categoria is distinct from old.categoria then
    new.categoria_verificata_il := null;
  end if;

  return new;
end;
$$;

create trigger utenti_verifica_categoria
before update on public.utenti
for each row execute function public.proteggi_verifica_categoria();

-- Segna come verificata la categoria di un giocatore. Idempotente.
create function public.admin_verifica_categoria(p_utente uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quando timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può verificare una categoria.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.utenti
  set categoria_verificata_il = coalesce(categoria_verificata_il, now())
  where id = p_utente and anonimizzato_il is null and categoria is not null
  returning categoria_verificata_il into v_quando;

  if v_quando is null then
    raise exception 'Giocatore non trovato.'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;
  return v_quando;
end;
$$;

revoke all on function public.admin_verifica_categoria(uuid) from public, anon;
grant execute on function public.admin_verifica_categoria(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Effetti del cambio
-- ---------------------------------------------------------------------------

-- The first free seat of a board, like `verifica_posti_iscrizione()`: from 1
-- to the maximum, then past the highest one.
create function public.primo_posto_libero(p_tabellone uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select min(n)::integer
      from public.tabelloni tb,
        generate_series(1, tb.posti) as n
      where tb.id = p_tabellone
        and not exists (
          select 1 from public.iscrizioni i
          where i.tabellone_id = p_tabellone
            and i.stato in ('in_attesa', 'confermata')
            and i.posto = n
        )
    ),
    (
      select coalesce(max(i.posto), 0) + 1
      from public.iscrizioni i
      where i.tabellone_id = p_tabellone
        and i.stato in ('in_attesa', 'confermata')
    )
  );
$$;

revoke all on function public.primo_posto_libero(uuid) from public, anon, authenticated;

/*
 * What changing `p_utente` to `p_categoria` would do, as jsonb:
 * {
 *   da, a,
 *   iscrizioni: [{iscrizione_id, tappa_id, tappa, data_inizio, stato_tappa,
 *     posto_prima, posto_dopo, posti, occupati, oltre_massimo, in_girone}],
 *   bloccanti: [{tappa_id, tappa, data_inizio}]
 * }
 * `iscrizioni` = active registrations of stages not started yet (their
 * list can still change); `bloccanti` = active registrations of stages in
 * progress. Admin only.
 */
create function public.effetti_cambio_categoria(
  p_utente uuid,
  p_categoria public.categoria
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_da public.categoria;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può cambiare una categoria.'
      using errcode = 'insufficient_privilege';
  end if;

  select categoria into v_da
  from public.utenti
  where id = p_utente and anonimizzato_il is null;
  if not found then
    raise exception 'Giocatore non trovato.'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;

  return jsonb_build_object(
    'da', v_da,
    'a', p_categoria,
    'iscrizioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'iscrizione_id', i.id,
        'tappa_id', t.id,
        'tappa', t.nome,
        'data_inizio', t.data_inizio,
        'stato_tappa', t.stato,
        'posto_prima', i.posto,
        'posto_dopo', public.primo_posto_libero(nuovo.id),
        'posti', nuovo.posti,
        'occupati', (
          select count(*) from public.iscrizioni o
          where o.tabellone_id = nuovo.id
            and o.stato in ('in_attesa', 'confermata')
        ),
        'oltre_massimo', (
          select count(*) from public.iscrizioni o
          where o.tabellone_id = nuovo.id
            and o.stato in ('in_attesa', 'confermata')
        ) >= nuovo.posti,
        'in_girone', exists (
          select 1 from public.girone_iscrizioni gi where gi.iscrizione_id = i.id
        )
      ) order by t.data_inizio, t.id)
      from public.iscrizioni i
      join public.tappe t on t.id = i.tappa_id
      join public.tabelloni nuovo
        on nuovo.tappa_id = t.id and nuovo.categoria = p_categoria
      where i.utente_id = p_utente
        and i.stato in ('in_attesa', 'confermata')
        and i.tabellone_id <> nuovo.id
        and public.tappa_iscritti_modificabili(t.stato)
    ), '[]'::jsonb),
    'bloccanti', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tappa_id', t.id, 'tappa', t.nome, 'data_inizio', t.data_inizio
      ) order by t.data_inizio, t.id)
      from public.iscrizioni i
      join public.tappe t on t.id = i.tappa_id
      where i.utente_id = p_utente
        and i.stato in ('in_attesa', 'confermata')
        and t.stato = 'in_corso'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.effetti_cambio_categoria(uuid, public.categoria) from public, anon;
grant execute on function public.effetti_cambio_categoria(uuid, public.categoria) to authenticated;

-- «id:posto» of every registration that moves, sorted: what the dialog
-- showed must still be what happens.
create function public.firma_effetti_categoria(p_iscrizioni jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(x order by x), array[]::text[])
  from (
    select (e ->> 'iscrizione_id') || ':' || coalesce(e ->> 'posto_dopo', '') as x
    from jsonb_array_elements(coalesce(p_iscrizioni, '[]'::jsonb)) e
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- Il cambio
-- ---------------------------------------------------------------------------

/*
 * Changes the category of `p_utente`. `p_attesi` = the `iscrizioni` the
 * admin confirmed ([{iscrizione_id, posto_dopo}]); if they no longer match
 * it raises 40001 `effetti_cambiati` and changes nothing. Refusals: 42501;
 * P0002 `giocatore_non_trovato`; 23514 `stessa_categoria`, `tappa_in_corso`
 * (detail = stage name). Returns {da, a, iscrizioni, tappe_classifica}:
 * one stage per season the player has played (to republish the overall
 * standings) and the moved registrations.
 */
create function public.admin_cambia_categoria(
  p_utente uuid,
  p_categoria public.categoria,
  p_attesi jsonb default '[]'::jsonb,
  p_nota text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_da public.categoria;
  v_effetti jsonb;
  v_voce jsonb;
  v_vecchio uuid;
  v_nuovo uuid;
  v_tolti integer;
  v_nota text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può cambiare una categoria.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_categoria is null then
    raise exception 'Categoria mancante.'
      using errcode = 'check_violation', hint = 'categoria_mancante';
  end if;

  select categoria into v_da
  from public.utenti
  where id = p_utente and anonimizzato_il is null
  for update;
  if not found then
    raise exception 'Giocatore non trovato.'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;
  if v_da is not distinct from p_categoria then
    raise exception 'Il giocatore è già in questa categoria.'
      using errcode = 'check_violation', hint = 'stessa_categoria';
  end if;

  -- Same lock as `iscrizioni_posti`: both boards of every stage the player
  -- is registered to, in a stable order.
  perform 1
  from public.tabelloni tb
  where tb.tappa_id in (
    select i.tappa_id from public.iscrizioni i
    where i.utente_id = p_utente and i.stato in ('in_attesa', 'confermata')
  )
  order by tb.id
  for update;

  v_effetti := public.effetti_cambio_categoria(p_utente, p_categoria);

  if jsonb_array_length(v_effetti -> 'bloccanti') > 0 then
    raise exception 'Il giocatore è iscritto a una tappa in corso.'
      using errcode = 'check_violation', hint = 'tappa_in_corso',
        detail = v_effetti -> 'bloccanti' -> 0 ->> 'tappa';
  end if;

  if public.firma_effetti_categoria(v_effetti -> 'iscrizioni')
     <> public.firma_effetti_categoria(p_attesi) then
    raise exception 'Gli effetti del cambio sono cambiati.'
      using errcode = 'serialization_failure', hint = 'effetti_cambiati';
  end if;

  perform set_config('blvs.cambio_categoria', 'on', true);

  -- First the profile: `iscrizioni_categoria` checks the new board against it.
  update public.utenti
  set categoria = p_categoria, categoria_verificata_il = now()
  where id = p_utente;

  for v_voce in select * from jsonb_array_elements(v_effetti -> 'iscrizioni') loop
    select i.tabellone_id into v_vecchio
    from public.iscrizioni i where i.id = (v_voce ->> 'iscrizione_id')::uuid;
    select tb.id into v_nuovo
    from public.tabelloni tb
    where tb.tappa_id = (v_voce ->> 'tappa_id')::uuid and tb.categoria = p_categoria;

    -- Like `admin_rimuovi_iscrizione()`: the player leaves the proposed
    -- groups of the old board, whose editor version moves on.
    delete from public.girone_iscrizioni
    where iscrizione_id = (v_voce ->> 'iscrizione_id')::uuid;
    get diagnostics v_tolti = row_count;
    if v_tolti > 0 then
      update public.tabelloni
      set versione_gironi = versione_gironi + 1
      where id = v_vecchio;
    end if;

    update public.iscrizioni
    set tabellone_id = v_nuovo, posto = (v_voce ->> 'posto_dopo')::integer
    where id = (v_voce ->> 'iscrizione_id')::uuid;

    perform public.registra_evento(
      'cambio_categoria', 'iscrizioni', v_voce ->> 'iscrizione_id',
      jsonb_build_object(
        'categoria', v_da,
        'posto', v_voce -> 'posto_prima',
        'tappa_id', v_voce ->> 'tappa_id'
      ),
      jsonb_build_object(
        'categoria', p_categoria,
        'posto', v_voce -> 'posto_dopo',
        'oltre_massimo', v_voce -> 'oltre_massimo',
        'tappa_id', v_voce ->> 'tappa_id'
      ),
      v_nota
    );
  end loop;

  perform public.registra_evento(
    'cambio_categoria', 'utenti', p_utente::text,
    jsonb_build_object('categoria', v_da),
    jsonb_build_object(
      'categoria', p_categoria,
      'iscrizioni_spostate', jsonb_array_length(v_effetti -> 'iscrizioni')
    ),
    v_nota
  );

  return jsonb_build_object(
    'da', v_da,
    'a', p_categoria,
    'iscrizioni', v_effetti -> 'iscrizioni',
    'tappe_classifica', coalesce((
      select jsonb_agg(tappa_id)
      from (
        select distinct on (t.stagione) t.id as tappa_id
        from public.iscrizioni i
        join public.tappe t on t.id = i.tappa_id
        where i.utente_id = p_utente
          and public.tappa_in_classifica(t.stato)
        order by t.stagione, t.data_inizio desc, t.id
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_cambia_categoria(uuid, public.categoria, jsonb, text) from public, anon;
grant execute on function public.admin_cambia_categoria(uuid, public.categoria, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Classifica generale: i punti seguono la categoria attuale
-- ---------------------------------------------------------------------------

/*
 * The rows of ONE board category (the body of BLVS-44/50's
 * `classifica_generale_dati`), plus `categoria_attuale` per registration.
 * Internal: only `classifica_generale_dati` calls it.
 */
create function public.classifica_tabellone_dati(
  p_categoria public.categoria,
  p_stagione integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tappe as (
    select t.id, t.nome, t.data_inizio, t.stagione, tb.id as tabellone_id,
      tb.concluso_il is not null as concluso
    from public.tappe t
    join public.tabelloni tb on tb.tappa_id = t.id and tb.categoria = p_categoria
    where public.tappa_in_classifica(t.stato)
      and (p_stagione is null or t.stagione = p_stagione)
  ),
  finali as (
    select g.id, tp.id as tappa_id, g.fase
    from public.gironi g
    join tappe tp on tp.tabellone_id = g.tabellone_id
    where g.fase in ('finale_gold', 'finale_silver')
  ),
  partite_finali as (
    select p.id, p.girone_id, p.stato
    from public.partite p
    join finali f on f.id = p.girone_id
  ),
  giocate as (
    select distinct pg.iscrizione_id
    from public.partita_giocatori pg
    join public.partite p on p.id = pg.partita_id
    join tappe tp on tp.tabellone_id = p.tabellone_id
    where p.stato = 'conclusa'
  ),
  in_finale as (
    select gi.iscrizione_id
    from public.girone_iscrizioni gi
    join finali f on f.id = gi.girone_id
    union
    select pg.iscrizione_id
    from public.partita_giocatori pg
    join partite_finali pf on pf.id = pg.partita_id
  ),
  iscritti as (
    select i.id, i.tappa_id, i.utente_id, i.stato,
      u.categoria as categoria_attuale,
      u.anonimizzato_il is not null as anonimo,
      case when u.anonimizzato_il is null then u.nome
        else (select a.nome from public.nome_anonimo() a) end as nome,
      case when u.anonimizzato_il is null then u.cognome
        else (select a.cognome from public.nome_anonimo() a) end as cognome
    from public.iscrizioni i
    join tappe tp on tp.id = i.tappa_id and tp.tabellone_id = i.tabellone_id
    join public.utenti u on u.id = i.utente_id
    where (i.stato in ('confermata', 'ritirata')
        and i.id in (select iscrizione_id from giocate))
      or i.id in (select iscrizione_id from in_finale)
  )
  select jsonb_build_object(
    'tappe', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'nome', nome, 'data_inizio', data_inizio,
        'stagione', stagione, 'concluso', concluso
      ) order by data_inizio, id) from tappe), '[]'::jsonb),
    'gironi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tappa_id', tappa_id, 'fase', fase
      )) from finali), '[]'::jsonb),
    'membri', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', gi.girone_id, 'iscrizione_id', gi.iscrizione_id
      ))
      from public.girone_iscrizioni gi
      join finali f on f.id = gi.girone_id), '[]'::jsonb),
    'partite', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pf.id,
        'girone_id', pf.girone_id,
        'stato', pf.stato,
        'punteggi', jsonb_build_object(
          'sets', coalesce((
            select pu.sets from public.punteggi pu where pu.partita_id = pf.id
          ), '[]'::jsonb)
        ),
        'partita_giocatori', coalesce((
          select jsonb_agg(jsonb_build_object(
            'iscrizione_id', pg.iscrizione_id, 'squadra', pg.squadra
          ))
          from public.partita_giocatori pg where pg.partita_id = pf.id
        ), '[]'::jsonb)
      )) from partite_finali pf), '[]'::jsonb),
    'decisioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', s.girone_id, 'firma', s.firma, 'ordine', to_jsonb(s.ordine)
      ))
      from public.spareggi_girone s
      join finali f on f.id = s.girone_id), '[]'::jsonb),
    'iscrizioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tappa_id', tappa_id, 'utente_id', utente_id,
        'nome', nome, 'cognome', cognome, 'stato', stato, 'anonimo', anonimo,
        'categoria_attuale', categoria_attuale
      )) from iscritti), '[]'::jsonb)
  );
$$;

revoke all on function public.classifica_tabellone_dati(public.categoria, integer)
  from public, anon, authenticated;

/*
 * The board of `p_categoria` as before (w-classifica-tappa reads it per
 * stage), plus `altro`: the same rows for the other category's board. The
 * overall standing of `p_categoria` takes the players whose CURRENT
 * category is `p_categoria` from both (BLVS-54).
 */
create or replace function public.classifica_generale_dati(
  p_categoria public.categoria,
  p_stagione integer default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.classifica_tabellone_dati(p_categoria, p_stagione)
    || jsonb_build_object(
      'altro',
      public.classifica_tabellone_dati(
        (case when p_categoria = 'M' then 'F' else 'M' end)::public.categoria,
        p_stagione
      )
    );
$$;
