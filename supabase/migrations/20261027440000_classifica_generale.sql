-- BLVS-44 · Classifica generale (R-44…R-73).
--
-- The overall standing is computed on read, like the stage standing
-- (BLVS-40): no stored totals. This migration only adds:
--   - `tappe.stagione`: the season a stage counts for, editable by the
--     admin (Q-06), defaulting to the year of `data_inizio`;
--   - `imposta_stagione_tappa()`: the admin RPC that changes it;
--   - `stagioni_classifica()` / `classifica_generale_dati()`: security
--     definer reads for everyone (anon included: the standing is public),
--     returning names only, never emails.

-- ---------------------------------------------------------------------------
-- Season of a stage
-- ---------------------------------------------------------------------------

alter table public.tappe add column if not exists stagione integer;

update public.tappe
set stagione = extract(year from data_inizio)::integer
where stagione is null;

alter table public.tappe
  alter column stagione set not null,
  add constraint tappe_stagione_valida check (stagione between 2000 and 2100);

comment on column public.tappe.stagione is
  'Season the stage counts for in the overall standing (BLVS-44). Defaults to the year of data_inizio; the admin can change it.';

-- A new stage without a season takes the year of its first day.
create function public.tappe_stagione_predefinita()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stagione is null then
    new.stagione := extract(year from new.data_inizio)::integer;
  end if;
  return new;
end;
$$;

create trigger tappe_stagione_predefinita
before insert on public.tappe
for each row execute function public.tappe_stagione_predefinita();

-- Admin only. Allowed in every state but `archiviata` (the BLVS-22 trigger
-- refuses that update with hint `tappa_archiviata`).
create function public.imposta_stagione_tappa(p_tappa uuid, p_stagione integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_versione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può cambiare la stagione'
      using errcode = 'insufficient_privilege';
  end if;
  if p_stagione is null or p_stagione not between 2000 and 2100 then
    raise exception 'Stagione non valida'
      using errcode = 'check_violation', hint = 'stagione_non_valida';
  end if;

  update public.tappe set stagione = p_stagione
  where id = p_tappa
  returning versione into v_versione;
  if not found then
    raise exception 'Tappa non trovata' using errcode = 'no_data_found';
  end if;
  return v_versione;
end;
$$;

revoke all on function public.imposta_stagione_tappa(uuid, integer) from public, anon;
grant execute on function public.imposta_stagione_tappa(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Public reads for the overall standing
-- ---------------------------------------------------------------------------

-- Stages that count: started or over, never drafts or cancelled ones.
create function public.tappa_in_classifica(p_stato public.stato_tappa)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_stato in ('in_corso', 'conclusa', 'archiviata');
$$;

-- Seasons with at least one stage that counts, newest first.
create function public.stagioni_classifica()
returns setof integer
language sql
stable
security definer
set search_path = ''
as $$
  select distinct t.stagione
  from public.tappe t
  where public.tappa_in_classifica(t.stato)
  order by t.stagione desc;
$$;

revoke all on function public.stagioni_classifica() from public;
grant execute on function public.stagioni_classifica() to anon, authenticated;

/*
 * Everything the overall standing of one category needs, for the stages of
 * one season (or every season when p_stagione is null), as one jsonb:
 *
 * - tappe: [{id, nome, data_inizio, stagione, concluso}]
 * - gironi: final groups only [{id, tappa_id, fase}] (BLVS-39 finale_*)
 * - membri: [{girone_id, iscrizione_id}] of those finals
 * - partite: final matches [{id, girone_id, stato, punteggi:{sets},
 *   partita_giocatori:[{iscrizione_id, squadra}]}] (PartitaGironeRow shape)
 * - decisioni: [{girone_id, firma, ordine}] stored tie decisions
 * - iscrizioni: [{id, tappa_id, utente_id, nome, cognome, stato}] of the
 *   players who count: a confirmed (or later withdrawn) registration with
 *   at least one concluded match, plus anyone in a final.
 *
 * Security definer: names are otherwise admin-only under RLS. It exposes
 * names and results only, which are public on the standings page.
 */
create function public.classifica_generale_dati(
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
    select i.id, i.tappa_id, i.utente_id, u.nome, u.cognome, i.stato
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
        'nome', nome, 'cognome', cognome, 'stato', stato
      )) from iscritti), '[]'::jsonb)
  );
$$;

revoke all on function public.classifica_generale_dati(public.categoria, integer) from public;
grant execute on function public.classifica_generale_dati(public.categoria, integer) to anon, authenticated;
