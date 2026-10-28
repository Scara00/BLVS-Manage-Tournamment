-- BLVS-55 · Palette dei comandi (w-admin-palette): matches of every stage
-- found by the words of a search. Every word must be in the stage name,
-- the group name or the name of one of the match's players. Admin only;
-- security invoker, so RLS still applies.

create function public.cerca_partite_admin(
  p_parole text[],
  p_limite integer default 5
)
returns table (
  partita_id uuid,
  tappa_id uuid,
  tappa_nome text,
  categoria public.categoria,
  fase text,
  girone_nome text,
  turno integer,
  stato public.stato_partita,
  sets jsonb,
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
    raise exception 'Solo l''amministrazione può cercare le partite'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(array_length(p_parole, 1), 0) = 0 then
    return;
  end if;

  return query
  with candidate as (
    select
      p.id,
      t.id as tappa,
      t.nome as tappa_nome,
      t.data_inizio,
      tb.categoria,
      p.fase,
      g.nome as girone_nome,
      p.turno,
      p.stato,
      concat_ws(
        ' ',
        t.nome,
        g.nome,
        (
          select string_agg(u.nome || ' ' || u.cognome, ' ')
          from public.partita_giocatori pg
          join public.iscrizioni i on i.id = pg.iscrizione_id
          join public.utenti u on u.id = i.utente_id
          where pg.partita_id = p.id
        )
      ) as testo
    from public.partite p
    join public.tabelloni tb on tb.id = p.tabellone_id
    join public.tappe t on t.id = tb.tappa_id
    left join public.gironi g on g.id = p.girone_id
  )
  select
    c.id,
    c.tappa,
    c.tappa_nome,
    c.categoria,
    c.fase,
    c.girone_nome,
    c.turno,
    c.stato,
    coalesce(pt.sets, '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('nome', u.nome, 'cognome', u.cognome)
        order by i.posto nulls last, u.cognome, u.nome
      )
      from public.partita_giocatori pg
      join public.iscrizioni i on i.id = pg.iscrizione_id
      join public.utenti u on u.id = i.utente_id
      where pg.partita_id = c.id and pg.squadra = 'A'
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(
        jsonb_build_object('nome', u.nome, 'cognome', u.cognome)
        order by i.posto nulls last, u.cognome, u.nome
      )
      from public.partita_giocatori pg
      join public.iscrizioni i on i.id = pg.iscrizione_id
      join public.utenti u on u.id = i.utente_id
      where pg.partita_id = c.id and pg.squadra = 'B'
    ), '[]'::jsonb)
  from candidate c
  left join public.punteggi pt on pt.partita_id = c.id
  where (
    select bool_and(
      c.testo ilike '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
    from unnest(p_parole) as w
  )
  order by c.data_inizio desc, c.categoria, c.girone_nome nulls last, c.turno, c.id
  limit least(greatest(coalesce(p_limite, 5), 1), 20);
end;
$$;

revoke all on function public.cerca_partite_admin(text[], integer)
  from public, anon;
grant execute on function public.cerca_partite_admin(text[], integer)
  to authenticated;
