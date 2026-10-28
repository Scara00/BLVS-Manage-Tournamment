-- ---------------------------------------------------------------------------
-- correggi_punteggio: BLVS-42 (ritiro_assenza) redefined it with the shared
-- impact helpers after BLVS-43 (chiusura_tabellone) had added the closed-board
-- rules. This brings both together.
--   23514 tabellone_concluso            «Rigenera» on a closed board
--   23514 conferma_tabellone_concluso   no confirmation
-- ---------------------------------------------------------------------------

create or replace function public.correggi_punteggio(
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
  v_concluso boolean;
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
  select tb.concluso_il is not null into v_concluso
  from public.tabelloni tb
  where tb.id = v_partita.tabellone_id
  for update;

  select
    count(*)::integer,
    count(*) filter (where jsonb_array_length(f.sets) > 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'partita_id', f.partita_id, 'fase', f.fase, 'turno', f.turno,
          'girone', f.girone,
          'sets', f.sets, 'squadra_a', f.squadra_a, 'squadra_b', f.squadra_b
        )
      ) filter (where jsonb_array_length(f.sets) > 0),
      '[]'::jsonb
    )
  into v_successive, v_persi, v_punteggi
  from public.fase_successiva_correzione(p_partita) f;

  perform public.controlla_impatto_fase(
    v_successive, v_persi, p_scelta, p_conferma, p_attesi
  );

  -- BLVS-43: on a closed board the next phase (the finals) is kept, and
  -- the admin confirms explicitly that a definitive result changes.
  if v_concluso then
    if p_scelta = 'rigenera' then
      raise exception 'Il tabellone è concluso: la fase successiva non si rigenera più'
        using errcode = 'check_violation', hint = 'tabellone_concluso';
    end if;
    if not coalesce(p_conferma, false) then
      raise exception 'Il tabellone è concluso: conferma la correzione'
        using errcode = 'check_violation', hint = 'conferma_tabellone_concluso';
    end if;
  end if;

  v_nota := concat_ws(
    ' · ',
    case when v_concluso then 'Correzione su tabellone concluso' end,
    case when p_sovrascrivi then 'Sovrascrittura dopo conflitto' end,
    public.nota_impatto_fase(v_successive, v_persi, p_scelta)
  );
  perform set_config('blvs.nota_registro', coalesce(v_nota, ''), true);
  perform set_config(
    'blvs.correzione_conclusa', case when v_concluso then 'on' else '' end, true
  );

  select s.versione, s.tipo into v_salvato
  from public.salva_punteggio(p_partita, p_versione, p_a, p_b) s;

  perform set_config('blvs.nota_registro', '', true);
  perform set_config('blvs.correzione_conclusa', '', true);

  if v_successive > 0 and p_scelta = 'rigenera' then
    perform public.elimina_fase_successiva(p_partita);
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
