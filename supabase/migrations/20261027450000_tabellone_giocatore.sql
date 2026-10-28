-- BLVS-48 · Gironi e fasi (w-tabellone, R-07, R-09, R-28, R-30).
--
-- The player's view of a stage's boards: the phase of each board and every
-- group with its standing. The standing is computed on read in TS
-- (BLVS-27 `classificaGirone`), so this migration only adds one read.
--
-- `tabellone_giocatore_dati(p_tappa)` is security definer because player
-- names (`utenti`) and absences (`assenze_partita`) are admin-only under
-- RLS. It returns names and results only, never emails, and only to
-- signed-in users (client decision: the page is for players, like w-live).
-- Drafts and missing stages return null.
--
-- Shape (one jsonb):
-- - tappa: {id, nome, stato}
-- - tabelloni: [{id, categoria, fase_gioco, concluso_il}]
-- - gironi: [{id, tabellone_id, nome, posizione, fase}]
-- - membri: [{girone_id, iscrizione_id}]
-- - partite: [{id, girone_id, stato, punteggi:{sets},
--   partita_giocatori:[{iscrizione_id, squadra}]}] (PartitaGironeRow shape)
-- - decisioni: [{girone_id, firma, ordine}]
-- - nomi: [{iscrizione_id, nome, cognome}] of every member or match player
-- - assenze: [{partita_id, iscrizione_id, tipo}] (BLVS-42 notes)

create function public.tabellone_giocatore_dati(p_tappa uuid)
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
        'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome
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

revoke all on function public.tabellone_giocatore_dati(uuid) from public, anon;
grant execute on function public.tabellone_giocatore_dati(uuid) to authenticated;
