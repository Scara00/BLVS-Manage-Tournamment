-- Classifiche del misto: uomini e donne a parte.
--
-- In un girone misto (4 uomini + 4 donne) uomini e donne si qualificano a
-- parte, quindi la classifica li ordina a parte: posti da 1 per categoria,
-- parità solo tra giocatori della stessa categoria, linea gold/silver per
-- categoria e in finale il miglior uomo (King) e la miglior donna (Queen).
-- La classifica si calcola in TS (src/lib/gironi/classifica/classifica.ts,
-- opzione `categorie`): qui le due RPC che passano i giocatori all'app ne
-- restituiscono anche la categoria. Nient'altro cambia.

-- Tabellone dei giocatori: `nomi` porta anche la categoria.
create or replace function public.tabellone_giocatore_dati(p_tappa uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tappa as (
    select t.id, t.nome, t.stato
    from public.tappe t
    where t.id = p_tappa and t.stato <> 'bozza'
  ),
  tabelloni as (
    select tb.id, tb.categoria, tb.fase_gioco, tb.concluso_il
    from public.tabelloni tb
    join tappa tp on tp.id = tb.tappa_id
  ),
  gironi as (
    select g.id, g.tabellone_id, g.nome, g.posizione, g.fase
    from public.gironi g
    join tabelloni tb on tb.id = g.tabellone_id
  ),
  partite as (
    select p.id, p.girone_id, p.stato
    from public.partite p
    join gironi g on g.id = p.girone_id
  ),
  giocatori as (
    select gi.iscrizione_id
    from public.girone_iscrizioni gi
    join gironi g on g.id = gi.girone_id
    union
    select pg.iscrizione_id
    from public.partita_giocatori pg
    join partite p on p.id = pg.partita_id
  )
  select case when not exists (select 1 from tappa) then null else
  jsonb_build_object(
    'tappa', (
      select jsonb_build_object('id', id, 'nome', nome, 'stato', stato)
      from tappa
    ),
    'tabelloni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'categoria', categoria, 'fase_gioco', fase_gioco,
        'concluso_il', concluso_il
      ) order by categoria) from tabelloni), '[]'::jsonb),
    'gironi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'tabellone_id', tabellone_id, 'nome', nome,
        'posizione', posizione, 'fase', fase
      ) order by posizione, nome) from gironi), '[]'::jsonb),
    'membri', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', gi.girone_id, 'iscrizione_id', gi.iscrizione_id
      ))
      from public.girone_iscrizioni gi
      join gironi g on g.id = gi.girone_id), '[]'::jsonb),
    'partite', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'girone_id', p.girone_id,
        'stato', p.stato,
        'punteggi', jsonb_build_object(
          'sets', coalesce((
            select pu.sets from public.punteggi pu where pu.partita_id = p.id
          ), '[]'::jsonb)
        ),
        'partita_giocatori', coalesce((
          select jsonb_agg(jsonb_build_object(
            'iscrizione_id', pg.iscrizione_id, 'squadra', pg.squadra
          ))
          from public.partita_giocatori pg where pg.partita_id = p.id
        ), '[]'::jsonb)
      )) from partite p), '[]'::jsonb),
    'decisioni', coalesce((
      select jsonb_agg(jsonb_build_object(
        'girone_id', s.girone_id, 'firma', s.firma, 'ordine', to_jsonb(s.ordine)
      ))
      from public.spareggi_girone s
      join gironi g on g.id = s.girone_id), '[]'::jsonb),
    'nomi', coalesce((
      select jsonb_agg(jsonb_build_object(
        'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome,
        'categoria', u.categoria
      ))
      from public.iscrizioni i
      join public.utenti u on u.id = i.utente_id
      where i.id in (select iscrizione_id from giocatori)), '[]'::jsonb),
    'assenze', coalesce((
      select jsonb_agg(jsonb_build_object(
        'partita_id', a.partita_id, 'iscrizione_id', a.iscrizione_id,
        'tipo', a.tipo
      ))
      from public.assenze_partita a
      join partite p on p.id = a.partita_id), '[]'::jsonb)
  ) end;
$$;

-- Inserimento e correzione dei punteggi: anche qui la categoria dei
-- giocatori, per l'anteprima della classifica dopo una correzione.
create or replace function public.partite_punteggio_tappa(
  p_tappa uuid,
  p_partita uuid default null
)
returns table (
  partita_id uuid,
  categoria public.categoria,
  girone_id uuid,
  girone_nome text,
  girone_posizione integer,
  turno integer,
  campo text,
  stato public.stato_partita,
  sets jsonb,
  versione integer,
  squadra_a jsonb,
  squadra_b jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può inserire i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    tb.categoria,
    g.id,
    g.nome,
    g.posizione,
    p.turno,
    p.campo,
    p.stato,
    coalesce(pt.sets, '[]'::jsonb),
    coalesce(pt.versione, 1),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome,
          'categoria', u.categoria
        )
        order by i.posto nulls last, u.cognome, u.nome
      )
      from public.partita_giocatori pg
      join public.iscrizioni i on i.id = pg.iscrizione_id
      join public.utenti u on u.id = i.utente_id
      where pg.partita_id = p.id and pg.squadra = 'A'
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome,
          'categoria', u.categoria
        )
        order by i.posto nulls last, u.cognome, u.nome
      )
      from public.partita_giocatori pg
      join public.iscrizioni i on i.id = pg.iscrizione_id
      join public.utenti u on u.id = i.utente_id
      where pg.partita_id = p.id and pg.squadra = 'B'
    ), '[]'::jsonb)
  from public.partite p
  join public.tabelloni tb on tb.id = p.tabellone_id
  join public.gironi g on g.id = p.girone_id
  left join public.punteggi pt on pt.partita_id = p.id
  where tb.tappa_id = p_tappa
    and p.fase = 'gironi'
    and (p_partita is null or p.id = p_partita)
  order by tb.categoria, g.posizione, g.nome, p.turno;
end;
$$;
