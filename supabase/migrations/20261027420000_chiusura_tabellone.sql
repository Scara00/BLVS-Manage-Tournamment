-- BLVS-43 · Chiusura del tabellone e punti definitivi.
--
-- «Concludi tabellone» sets `tabelloni.concluso_il` (the hook BLVS-22's
-- `tabelloni_conclusi()` and BLVS-40's stage points already read): the
-- board's phase reads «Conclusa» (derived, `fase_gioco` stays 'finali'),
-- its points are final, and once both boards are closed the stage moves to
-- `conclusa`, so «Archivia» is allowed.
--
-- A score of a closed board changes only through an explicit, confirmed
-- correction: the guard `punteggi_tabellone_concluso` refuses any other
-- write of its sets. The two correction paths set the tx-local GUC
-- `blvs.correzione_conclusa` after the confirmation:
--   * `correggi_punteggio` (BLVS-41, group matches): only «Mantieni»;
--   * `correggi_tabellone_concluso` (finals, from w-admin-live).
-- Both write `correzione_punteggio` in the registro with the nota
-- «Correzione su tabellone concluso».

-- ---------------------------------------------------------------------------
-- Esito di una partita
-- ---------------------------------------------------------------------------

-- 'A' / 'B' = the team that won more sets, null with no winner. Mirror of
-- `vincitore()` in src/lib/tappe/live-admin/format.ts.
create function public.vincitore_sets(p_sets jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when a > b then 'A'
    when b > a then 'B'
  end
  from (
    select
      count(*) filter (where (s ->> 'a')::int > (s ->> 'b')::int) as a,
      count(*) filter (where (s ->> 'b')::int > (s ->> 'a')::int) as b
    from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) s
  ) conti;
$$;

grant execute on function public.vincitore_sets(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Concludi tabellone
-- ---------------------------------------------------------------------------

-- Closes a board after both finals (BLVS-39 groups `finale_gold` and
-- `finale_silver`). `p_punti` = the definitive points computed in TS
-- (`classificaTappa`), kept in the registro as the closing snapshot.
-- Open perfect ties are checked in TS (`bloccoChiusura`), like
-- `puoAvanzare`: standings are computed on read.
--
-- Refuses with 23514 and hint:
--   tappa_archiviata       the stage is archived
--   tappa_non_in_corso     the stage is not in progress
--   tabellone_concluso     already closed
--   fase_non_finali        the board is not in «finali», or a final is missing
--   partite_non_concluse   a match is not concluded with a winner
--                          (detail = how many)
-- Returns when it was closed and whether the stage is now concluded.
create function public.concludi_tabellone(
  p_tabellone uuid,
  p_punti jsonb default '[]'::jsonb
)
returns table (concluso_il timestamptz, tappa_conclusa boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tb record;
  v_aperte integer;
  v_finali integer;
  v_ora timestamptz := now();
  v_conclusa boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può concludere un tabellone'
      using errcode = 'insufficient_privilege';
  end if;

  select tb.id, tb.tappa_id, tb.categoria, tb.fase_gioco,
    tb.concluso_il, t.stato
  into v_tb
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where tb.id = p_tabellone
  for update of tb;
  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  if v_tb.stato = 'archiviata' then
    raise exception 'La tappa è archiviata: i dati non si modificano più'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_tb.concluso_il is not null then
    raise exception 'Il tabellone è già concluso'
      using errcode = 'check_violation', hint = 'tabellone_concluso';
  end if;
  if v_tb.stato <> 'in_corso' then
    raise exception 'La tappa non è in corso'
      using errcode = 'check_violation', hint = 'tappa_non_in_corso';
  end if;

  select count(distinct g.fase) into v_finali
  from public.gironi g
  where g.tabellone_id = p_tabellone
    and g.fase in ('finale_gold', 'finale_silver');
  if v_tb.fase_gioco is distinct from 'finali' or v_finali < 2 then
    raise exception 'Il tabellone non è nella fase delle finali'
      using errcode = 'check_violation', hint = 'fase_non_finali';
  end if;

  select count(*)::integer into v_aperte
  from public.partite p
  left join public.punteggi pt on pt.partita_id = p.id
  where p.tabellone_id = p_tabellone
    and p.stato <> 'annullata'
    and (p.stato <> 'conclusa' or public.vincitore_sets(pt.sets) is null);
  if v_aperte > 0 then
    raise exception 'Ci sono partite non concluse'
      using errcode = 'check_violation',
        hint = 'partite_non_concluse',
        detail = v_aperte::text;
  end if;

  update public.tabelloni tb
  set concluso_il = v_ora
  where tb.id = p_tabellone;

  perform public.registra_evento(
    'chiusura_tabellone',
    'tabelloni',
    p_tabellone::text,
    jsonb_build_object('tappa_id', v_tb.tappa_id, 'concluso_il', null),
    jsonb_build_object(
      'tappa_id', v_tb.tappa_id,
      'categoria', v_tb.categoria,
      'concluso_il', v_ora,
      'punti', coalesce(p_punti, '[]'::jsonb)
    ),
    null
  );

  -- The stage is concluded when both boards are.
  if public.tabelloni_conclusi(v_tb.tappa_id) then
    update public.tappe t
    set stato = 'conclusa'
    where t.id = v_tb.tappa_id and t.stato = 'in_corso';
    v_conclusa := true;
  end if;

  concluso_il := v_ora;
  tappa_conclusa := v_conclusa;
  return next;
end;
$$;

revoke all on function public.concludi_tabellone(uuid, jsonb) from public, anon;
grant execute on function public.concludi_tabellone(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Guardia: i punteggi di un tabellone concluso
-- ---------------------------------------------------------------------------

-- Any write of the sets of a closed board's match needs the confirmation
-- set by the correction RPCs (tx-local GUC `blvs.correzione_conclusa`).
-- It applies to everyone, admins and backend included.
create function public.punteggi_tabellone_concluso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sets is not distinct from old.sets then
    return new;
  end if;
  if exists (
    select 1
    from public.partite p
    join public.tabelloni tb on tb.id = p.tabellone_id
    where p.id = new.partita_id and tb.concluso_il is not null
  ) and coalesce(current_setting('blvs.correzione_conclusa', true), '') <> 'on'
  then
    raise exception 'Il tabellone è concluso: una correzione va confermata'
      using errcode = 'check_violation', hint = 'conferma_tabellone_concluso';
  end if;
  return new;
end;
$$;

create trigger punteggi_tabellone_concluso
before update on public.punteggi
for each row execute function public.punteggi_tabellone_concluso();

-- ---------------------------------------------------------------------------
-- Correzione di una finale su tabellone concluso (w-admin-live)
-- ---------------------------------------------------------------------------

-- The confirmed correction of a concluded match of a closed board, with
-- the version read (40001 `versione_superata`, detail = current version).
-- The board stays closed: points are recomputed on read and stay final.
-- Refuses with 23514: `tabellone_non_concluso` (use the normal save),
-- `partita_non_conclusa`, `senza_vincitore`, plus the archive guards.
create function public.correggi_tabellone_concluso(
  p_partita uuid,
  p_versione integer,
  p_sets jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partita record;
  v_punteggio record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può correggere i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  select p.id, p.stato, tb.tappa_id, tb.concluso_il
  into v_partita
  from public.partite p
  join public.tabelloni tb on tb.id = p.tabellone_id
  where p.id = p_partita
  for update of p;
  if not found then
    raise exception 'Partita non trovata.' using errcode = 'no_data_found';
  end if;
  if v_partita.concluso_il is null then
    raise exception 'Il tabellone non è concluso'
      using errcode = 'check_violation', hint = 'tabellone_non_concluso';
  end if;
  if v_partita.stato <> 'conclusa' then
    raise exception 'La partita non è conclusa'
      using errcode = 'check_violation', hint = 'partita_non_conclusa';
  end if;
  if public.vincitore_sets(p_sets) is null then
    raise exception 'Una partita conclusa ha una squadra vincente'
      using errcode = 'check_violation', hint = 'senza_vincitore';
  end if;

  select pt.sets, pt.versione into v_punteggio
  from public.punteggi pt
  where pt.partita_id = p_partita
  for update;
  if v_punteggio.versione is distinct from p_versione then
    raise exception 'Il punteggio è cambiato nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = coalesce(v_punteggio.versione, 0)::text;
  end if;

  perform set_config('blvs.correzione_conclusa', 'on', true);
  update public.punteggi pt
  set sets = p_sets,
      versione = v_punteggio.versione + 1,
      aggiornato_da = (select auth.uid())
  where pt.partita_id = p_partita;
  perform set_config('blvs.correzione_conclusa', '', true);

  perform public.registra_evento(
    'correzione_punteggio',
    'punteggi',
    p_partita::text,
    jsonb_build_object(
      'sets', v_punteggio.sets,
      'versione', v_punteggio.versione,
      'tappa_id', v_partita.tappa_id
    ),
    jsonb_build_object(
      'sets', p_sets,
      'versione', v_punteggio.versione + 1,
      'tappa_id', v_partita.tappa_id
    ),
    'Correzione su tabellone concluso'
  );
  return v_punteggio.versione + 1;
end;
$$;

revoke all on function public.correggi_tabellone_concluso(uuid, integer, jsonb)
  from public, anon;
grant execute on function public.correggi_tabellone_concluso(uuid, integer, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- salva_punteggio (BLVS-32): a closed board of a concluded stage still
-- takes a confirmed correction. Same body otherwise.
-- ---------------------------------------------------------------------------

create or replace function public.salva_punteggio(
  p_partita uuid,
  p_versione integer,
  p_a integer,
  p_b integer
)
returns table (versione integer, tipo public.tipo_evento_registro)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partita record;
  v_punteggio record;
  v_errore text;
  v_tipo public.tipo_evento_registro;
  v_sets jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può inserire i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  -- Due salvataggi contemporanei della stessa partita si mettono in coda.
  select p.id, p.stato, p.fase, tb.fase_gioco, t.stato as stato_tappa,
    tb.concluso_il
  into v_partita
  from public.partite p
  join public.tabelloni tb on tb.id = p.tabellone_id
  join public.tappe t on t.id = tb.tappa_id
  where p.id = p_partita
  for update of p;

  if not found then
    raise exception 'Partita non trovata.' using errcode = 'no_data_found';
  end if;

  if v_partita.stato_tappa = 'archiviata' then
    raise exception 'La tappa è archiviata: i dati non si modificano più'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  -- BLVS-43: a closed board of a concluded stage still takes a confirmed
  -- correction (the guard `punteggi_tabellone_concluso` checks it).
  if (v_partita.stato_tappa <> 'in_corso'
      and not (v_partita.stato_tappa = 'conclusa'
        and v_partita.concluso_il is not null))
    or v_partita.stato = 'annullata'
    or (v_partita.fase = 'gironi' and v_partita.fase_gioco is null) then
    raise exception 'Questa partita non accetta punteggi'
      using errcode = 'check_violation', hint = 'partita_non_giocabile';
  end if;

  v_errore := public.valida_punteggio(p_a, p_b);
  if v_errore is not null then
    raise exception 'Punteggio non valido'
      using errcode = 'check_violation', hint = v_errore;
  end if;

  select pt.sets, pt.versione into v_punteggio
  from public.punteggi pt
  where pt.partita_id = p_partita
  for update;

  if v_punteggio.versione is distinct from p_versione then
    raise exception 'Il punteggio è cambiato nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = coalesce(v_punteggio.versione, 0)::text;
  end if;

  v_tipo := case
    when v_partita.stato = 'conclusa'
      and jsonb_array_length(v_punteggio.sets) > 0
    then 'correzione_punteggio'
    else 'inserimento_punteggio'
  end;
  v_sets := jsonb_build_array(jsonb_build_object('a', p_a, 'b', p_b));

  update public.punteggi pt
  set sets = v_sets,
      versione = v_punteggio.versione + 1,
      aggiornato_da = (select auth.uid())
  where pt.partita_id = p_partita;

  update public.partite p
  set stato = 'conclusa'
  where p.id = p_partita and p.stato <> 'conclusa';

  perform public.registra_evento(
    v_tipo,
    'punteggi',
    p_partita::text,
    jsonb_build_object(
      'sets', v_punteggio.sets,
      'stato', v_partita.stato,
      'versione', v_punteggio.versione
    ),
    jsonb_build_object(
      'sets', v_sets,
      'stato', 'conclusa',
      'versione', v_punteggio.versione + 1
    ),
    null
  );

  versione := v_punteggio.versione + 1;
  tipo := v_tipo;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- correggi_punteggio (BLVS-41): on a closed board only «Mantieni», with an
-- explicit confirmation (`p_conferma`). Same body otherwise.
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
    case
      when v_successive = 0 then null
      when p_scelta = 'mantieni' then 'Fase successiva mantenuta'
      when v_persi = 0 then 'Fase successiva rigenerata'
      else 'Fase successiva rigenerata con ' || v_persi
        || case when v_persi = 1 then ' punteggio perso' else ' punteggi persi' end
    end
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

