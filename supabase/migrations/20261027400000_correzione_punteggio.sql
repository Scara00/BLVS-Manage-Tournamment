-- BLVS-41 · Correzione di un punteggio salvato (R-32, R-34, R-35).
-- A correction is a save of a concluded match through `salva_punteggio`
-- (BLVS-32), unchanged: same checks, same version rule, same registro
-- event `correzione_punteggio` with the previous value. Standings and
-- stage points are computed on read (BLVS-27, BLVS-40), so they follow.
-- This adds what happens when the board's next phase already exists:
--   * fase_successiva_correzione(): the next-phase matches a group score
--     change would affect, with their scores (the «punteggi persi»);
--   * correggi_punteggio(): the save, refused until the admin chose
--     «Mantieni» or «Rigenera» (with the confirmation box ticked);
--   * rigenera_fase_successiva(): hook for BLVS-39's generator.

-- ---------------------------------------------------------------------------
-- Fase successiva di un tabellone
-- ---------------------------------------------------------------------------

-- «Fase successiva» = the board's matches after the initial groups
-- (`fase` eliminazione/finale), the same notion as BLVS-30's
-- `fase_successiva`. If BLVS-39 models gold/silver as new groups, redefine
-- only this function and `rigenera_fase_successiva`.
create function public.fase_successiva_correzione(p_partita uuid)
returns table (
  partita_id uuid,
  fase text,
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
    raise exception 'Solo l''amministrazione può correggere i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    p.id,
    p.fase,
    p.turno,
    p.stato,
    coalesce(pt.sets, '[]'::jsonb),
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
  from public.partite corretta
  join public.partite p
    on p.tabellone_id = corretta.tabellone_id
   and p.fase in ('eliminazione', 'finale')
  left join public.punteggi pt on pt.partita_id = p.id
  left join public.partita_giocatori pg on pg.partita_id = p.id
  left join public.iscrizioni i on i.id = pg.iscrizione_id
  left join public.utenti u on u.id = i.utente_id
  where corretta.id = p_partita
    and corretta.fase = 'gironi'
  group by p.id, p.fase, p.turno, p.stato, pt.sets
  order by case p.fase when 'eliminazione' then 1 else 2 end, p.turno, p.id;
end;
$$;

revoke all on function public.fase_successiva_correzione(uuid) from public, anon;
grant execute on function public.fase_successiva_correzione(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Hook di rigenerazione (BLVS-39)
-- ---------------------------------------------------------------------------

-- Called by «Rigenera» after the next-phase matches were deleted. Returns
-- how many matches it created. Until BLVS-39 lands it creates none: the
-- next phase is then proposed again from the corrected standings.
-- TODO(BLVS-39): redefine with the gold/silver/finals generator.
create function public.rigenera_fase_successiva(p_tabellone uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return 0;
end;
$$;

revoke all on function public.rigenera_fase_successiva(uuid) from public, anon;
grant execute on function public.rigenera_fase_successiva(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Correzione con impatto sulla fase successiva
-- ---------------------------------------------------------------------------

-- p_scelta: null (no next phase expected), 'mantieni' or 'rigenera'.
-- p_conferma: «Rigenera» with the box ticked (needed when scores are lost).
-- p_attesi: how many next-phase scores the admin saw in the dialog.
-- p_sovrascrivi: «Sovrascrivi» after a conflict (BLVS-34): same note.
--
-- Errors (23514 unless noted), with hint:
--   impatto_richiesto        the next phase exists and no choice was made
--                            (detail = N scores that would be lost)
--   conferma_richiesta       «Rigenera» with scores to lose, box not ticked
--   scelta_non_valida        p_scelta is not mantieni/rigenera
--   40001 punteggi_cambiati  the next phase changed since the dialog
--                            (detail = current N)
--   plus every error of `salva_punteggio`.
create function public.correggi_punteggio(
  p_partita uuid,
  p_versione integer,
  p_a integer,
  p_b integer,
  p_scelta text default null,
  p_conferma boolean default false,
  p_attesi integer default null,
  p_sovrascrivi boolean default false
)
returns table (
  versione integer,
  tipo public.tipo_evento_registro,
  scelta text,
  punteggi_persi integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partita record;
  v_successive integer;
  v_persi integer;
  v_punteggi jsonb;
  v_create integer;
  v_salvato record;
  v_nota text;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può correggere i punteggi'
      using errcode = 'insufficient_privilege';
  end if;
  if p_scelta is not null and p_scelta not in ('mantieni', 'rigenera') then
    raise exception 'Scelta non valida'
      using errcode = 'check_violation', hint = 'scelta_non_valida';
  end if;

  select p.id, p.fase, p.tabellone_id, tb.tappa_id
  into v_partita
  from public.partite p
  join public.tabelloni tb on tb.id = p.tabellone_id
  where p.id = p_partita;
  if not found then
    raise exception 'Partita non trovata.' using errcode = 'no_data_found';
  end if;

  -- Same lock as avvia_fase / rigenera_gironi: the next phase cannot be
  -- generated or regenerated while the correction is being decided.
  perform 1 from public.tabelloni tb
  where tb.id = v_partita.tabellone_id
  for update;

  select
    count(*)::integer,
    count(*) filter (where jsonb_array_length(f.sets) > 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'partita_id', f.partita_id, 'fase', f.fase, 'turno', f.turno,
          'sets', f.sets, 'squadra_a', f.squadra_a, 'squadra_b', f.squadra_b
        )
      ) filter (where jsonb_array_length(f.sets) > 0),
      '[]'::jsonb
    )
  into v_successive, v_persi, v_punteggi
  from public.fase_successiva_correzione(p_partita) f;

  if v_successive > 0 then
    if p_scelta is null then
      raise exception 'La fase successiva è già generata: scegli se mantenerla o rigenerarla'
        using errcode = 'check_violation',
          hint = 'impatto_richiesto',
          detail = v_persi::text;
    end if;
    if p_attesi is distinct from v_persi then
      raise exception 'La fase successiva è cambiata nel frattempo'
        using errcode = 'serialization_failure',
          hint = 'punteggi_cambiati',
          detail = v_persi::text;
    end if;
    if p_scelta = 'rigenera' and v_persi > 0 and not coalesce(p_conferma, false) then
      raise exception 'Conferma che si perdono i punteggi della fase successiva'
        using errcode = 'check_violation',
          hint = 'conferma_richiesta',
          detail = v_persi::text;
    end if;
  end if;

  v_nota := concat_ws(
    ' · ',
    case when p_sovrascrivi then 'Sovrascrittura dopo conflitto' end,
    case
      when v_successive = 0 then null
      when p_scelta = 'mantieni' then 'Fase successiva mantenuta'
      when v_persi = 0 then 'Fase successiva rigenerata'
      else 'Fase successiva rigenerata con ' || v_persi
        || case when v_persi = 1 then ' punteggio perso' else ' punteggi persi' end
    end
  );
  perform set_config('blvs.nota_registro', coalesce(v_nota, ''), true);

  select s.versione, s.tipo into v_salvato
  from public.salva_punteggio(p_partita, p_versione, p_a, p_b) s;

  perform set_config('blvs.nota_registro', '', true);

  if v_successive > 0 and p_scelta = 'rigenera' then
    delete from public.partite p
    where p.tabellone_id = v_partita.tabellone_id
      and p.fase in ('eliminazione', 'finale');

    v_create := public.rigenera_fase_successiva(v_partita.tabellone_id);

    perform public.registra_evento(
      'rigenerazione_gironi',
      'tabelloni',
      v_partita.tabellone_id::text,
      jsonb_build_object(
        'tappa_id', v_partita.tappa_id,
        'fase', 'successiva',
        'partite', v_successive,
        'punteggi_persi', v_persi,
        'punteggi', v_punteggi
      ),
      jsonb_build_object(
        'tappa_id', v_partita.tappa_id,
        'fase', 'successiva',
        'partite', coalesce(v_create, 0),
        'punteggi_persi', v_persi,
        'correzione_di', p_partita
      ),
      'Fase successiva rigenerata dopo una correzione: '
        || v_persi
        || case when v_persi = 1 then ' punteggio perso' else ' punteggi persi' end
    );
  end if;

  versione := v_salvato.versione;
  tipo := v_salvato.tipo;
  scelta := case when v_successive > 0 then p_scelta end;
  punteggi_persi := case when p_scelta = 'rigenera' then v_persi else 0 end;
  return next;
end;
$$;

revoke all on function public.correggi_punteggio(uuid, integer, integer, integer, text, boolean, integer, boolean)
  from public, anon;
grant execute on function public.correggi_punteggio(uuid, integer, integer, integer, text, boolean, integer, boolean)
  to authenticated;
