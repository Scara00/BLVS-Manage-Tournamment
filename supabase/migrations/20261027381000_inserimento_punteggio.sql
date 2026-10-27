-- BLVS-32 · Inserimento del punteggio con riepilogo (R-31, R-32, R-33, R-35).
--
-- Una partita dei gironi si gioca su un solo set (decisione del cliente):
-- vince chi arriva a 21 con almeno 2 punti di scarto; oltre i 21 si va
-- avanti finché una coppia è avanti di esattamente 2, senza tetto.
-- La regola configurabile (Q-04) è in `public.regola_set()`, mirror di
-- `REGOLA_SET` in src/lib/punteggi/regola.ts: cambiale insieme.
--
-- Il salvataggio (`salva_punteggio`) scrive `punteggi.sets = [{a, b}]`,
-- porta la partita a `conclusa` (la classifica di BLVS-27 conta solo
-- quelle) e scrive nel registro `inserimento_punteggio` o
-- `correzione_punteggio`. `annulla_punteggio` ripristina il punteggio e
-- lo stato di prima entro pochi minuti dal salvataggio, solo se nessuno
-- l'ha cambiato nel frattempo, e scrive `annullamento_punteggio`.

-- ---------------------------------------------------------------------------
-- Regola del set (Q-04)
-- ---------------------------------------------------------------------------

-- TODO(Q-04): valori da confermare col cliente.
create function public.regola_set()
returns table (punti integer, scarto integer)
language sql
immutable
set search_path = ''
as $$
  select 21, 2;
$$;

grant execute on function public.regola_set() to anon, authenticated;

-- null se il punteggio è valido, altrimenti il codice (lo stesso usato come
-- hint): valori_non_validi | pareggio | regola_set. Mirror di
-- `codiceErrore()` in src/lib/punteggi/validazione.ts (massimo 99 punti).
create function public.valida_punteggio(p_a integer, p_b integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_regola record;
  v_vincente integer;
  v_scarto integer;
begin
  select * into v_regola from public.regola_set();

  if p_a is null or p_b is null
    or p_a < 0 or p_b < 0 or p_a > 99 or p_b > 99 then
    return 'valori_non_validi';
  end if;
  if p_a = p_b then
    return 'pareggio';
  end if;

  v_vincente := greatest(p_a, p_b);
  v_scarto := v_vincente - least(p_a, p_b);
  if v_vincente = v_regola.punti and v_scarto >= v_regola.scarto then
    return null;
  end if;
  if v_vincente > v_regola.punti and v_scarto = v_regola.scarto then
    return null;
  end if;
  return 'regola_set';
end;
$$;

grant execute on function public.valida_punteggio(integer, integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lettura: le partite dei gironi di una tappa, con le coppie
-- ---------------------------------------------------------------------------

create function public.partite_punteggio_tappa(
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
          'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome
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
          'iscrizione_id', i.id, 'nome', u.nome, 'cognome', u.cognome
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

revoke all on function public.partite_punteggio_tappa(uuid, uuid)
  from public, anon;
grant execute on function public.partite_punteggio_tappa(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Salvataggio
-- ---------------------------------------------------------------------------

create function public.salva_punteggio(
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
  select p.id, p.stato, p.fase, tb.fase_gioco, t.stato as stato_tappa
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
  if v_partita.stato_tappa <> 'in_corso'
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

revoke all on function public.salva_punteggio(uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.salva_punteggio(uuid, integer, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Annullamento del salvataggio appena fatto
-- ---------------------------------------------------------------------------

-- Il toast mostra «Annulla» per almeno 10 s (in pausa con hover o focus):
-- il server accetta fino a 120 s dal salvataggio, mirror di
-- `FINESTRA_ANNULLAMENTO_SECONDI` in src/lib/punteggi/regola.ts.
create function public.annulla_punteggio(p_partita uuid, p_versione integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_partita;
  v_punteggio record;
  v_evento public.registro;
  v_prima jsonb;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può annullare un punteggio'
      using errcode = 'insufficient_privilege';
  end if;

  select p.stato into v_stato
  from public.partite p
  where p.id = p_partita
  for update;

  if not found then
    raise exception 'Partita non trovata.' using errcode = 'no_data_found';
  end if;

  select pt.sets, pt.versione into v_punteggio
  from public.punteggi pt
  where pt.partita_id = p_partita
  for update;

  -- L'ultimo salvataggio della partita deve essere quello da annullare.
  select r.* into v_evento
  from public.registro r
  where r.entita = 'punteggi'
    and r.entita_id = p_partita::text
    and r.tipo in (
      'inserimento_punteggio', 'correzione_punteggio', 'annullamento_punteggio'
    )
  order by r.id desc
  limit 1;

  if v_punteggio.versione is distinct from p_versione
    or v_evento.id is null
    or v_evento.tipo = 'annullamento_punteggio'
    or (v_evento.valore_dopo ->> 'versione')::integer
      is distinct from p_versione then
    raise exception 'Il punteggio è cambiato dopo il salvataggio'
      using errcode = 'serialization_failure', hint = 'punteggio_cambiato';
  end if;

  if v_evento.created_at < now() - interval '120 seconds' then
    raise exception 'Il tempo per annullare è scaduto'
      using errcode = 'check_violation', hint = 'annullamento_scaduto';
  end if;

  v_prima := v_evento.valore_prima;

  update public.punteggi pt
  set sets = coalesce(v_prima -> 'sets', '[]'::jsonb),
      versione = v_punteggio.versione + 1,
      aggiornato_da = (select auth.uid())
  where pt.partita_id = p_partita;

  update public.partite p
  set stato = coalesce(
    (v_prima ->> 'stato')::public.stato_partita, 'programmata'
  )
  where p.id = p_partita;

  perform public.registra_evento(
    'annullamento_punteggio',
    'punteggi',
    p_partita::text,
    jsonb_build_object(
      'sets', v_punteggio.sets,
      'stato', v_stato,
      'versione', v_punteggio.versione
    ),
    jsonb_build_object(
      'sets', coalesce(v_prima -> 'sets', '[]'::jsonb),
      'stato', coalesce(v_prima ->> 'stato', 'programmata'),
      'versione', v_punteggio.versione + 1
    ),
    'Annullato entro la finestra di annullamento'
  );

  return v_punteggio.versione + 1;
end;
$$;

revoke all on function public.annulla_punteggio(uuid, integer)
  from public, anon;
grant execute on function public.annulla_punteggio(uuid, integer)
  to authenticated;
