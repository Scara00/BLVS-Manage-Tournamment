-- Tappa di prova (richiesta del cliente, 08/11/2026): per provare l'app
-- con un caso reale senza pubblicare la tappa.
--
-- `tappe.prova` si accende solo su una bozza (`admin_imposta_tappa_prova`).
-- Una bozza di prova:
-- - genera i gironi come a iscrizioni chiuse, e avvia fasi, punteggi,
--   parziali, ritiri, finali e chiusura come una tappa in corso;
-- - resta `bozza`: i giocatori non la vedono (RLS `tappe_select` e le
--   altre), non entra nella classifica generale (`tappa_in_classifica`) e
--   l'avvio o la chiusura non le cambiano stato;
-- - l'admin ne vede anche le pagine giocatore (tabellone, live, gironi,
--   classifica): `tabellone_giocatore_dati` la restituisce solo a lui.
-- La regola sta in un punto, `stato_di_gioco()`: le funzioni la usano per
-- i loro controlli al posto dello stato salvato. Spenta, la bozza torna una
-- bozza qualsiasi (i dati di prova restano).
-- TS: src/lib/tappe/prova.ts.

alter table public.tappe
  add column if not exists prova boolean not null default false;

comment on column public.tappe.prova is
  'Tappa di prova: in bozza usa gironi, punteggi, fasi e finali come in corso, senza essere pubblicata. Solo admin_imposta_tappa_prova().';

-- Lo stato che vedono i controlli di gioco: una bozza di prova si gioca
-- come una tappa in corso; ogni altro stato resta quello salvato.
create function public.stato_di_gioco(
  p_stato public.stato_tappa,
  p_prova boolean
)
returns public.stato_tappa
language sql
immutable
set search_path = ''
as $$
  select case
    when p_stato = 'bozza' and coalesce(p_prova, false)
      then 'in_corso'::public.stato_tappa
    else p_stato
  end;
$$;

grant execute on function public.stato_di_gioco(public.stato_tappa, boolean)
  to anon, authenticated, service_role;

-- Accende o spegne la tappa di prova. Si accende solo su una bozza; si
-- spegne sempre. Ritorna il nuovo valore.
create function public.admin_imposta_tappa_prova(
  p_tappa uuid,
  p_prova boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può cambiare la tappa di prova.'
      using errcode = 'insufficient_privilege';
  end if;

  select stato into v_stato from public.tappe where id = p_tappa for update;
  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;
  if coalesce(p_prova, false) and v_stato <> 'bozza' then
    raise exception 'Solo una tappa in bozza diventa una tappa di prova.'
      using errcode = 'check_violation', hint = 'prova_solo_bozza';
  end if;

  update public.tappe
  set prova = coalesce(p_prova, false)
  where id = p_tappa;

  return coalesce(p_prova, false);
end;
$$;

revoke all on function public.admin_imposta_tappa_prova(uuid, boolean)
  from public, anon;
grant execute on function public.admin_imposta_tappa_prova(uuid, boolean)
  to authenticated;

-- genera_gironi: come prima, con la tappa di prova.
create or replace function public.genera_gironi(p_tappa uuid)
returns table (
  categoria public.categoria,
  gironi integer,
  partite integer,
  esclusi jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
  v_tabellone record;
  v_esito record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può generare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select case
      -- Tappa di prova: in bozza i gironi si generano come a iscrizioni chiuse.
      when t.stato = 'bozza' and t.prova then 'iscrizioni_chiuse'::public.stato_tappa
      else t.stato
    end into v_stato
  from public.tappe t
  where t.id = p_tappa
  for update;

  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;

  if v_stato <> 'iscrizioni_chiuse' then
    raise exception 'I gironi si generano solo a iscrizioni chiuse'
      using errcode = 'check_violation', hint = 'iscrizioni_non_chiuse';
  end if;

  if exists (
    select 1
    from public.partite p
    join public.tabelloni tb on tb.id = p.tabellone_id
    left join public.punteggi pt on pt.partita_id = p.id
    where tb.tappa_id = p_tappa
      and (p.stato <> 'programmata' or jsonb_array_length(pt.sets) > 0)
  ) then
    raise exception 'Le partite sono già iniziate: i gironi non si rigenerano'
      using errcode = 'check_violation', hint = 'partite_iniziate';
  end if;

  delete from public.partite p
  using public.tabelloni tb
  where tb.id = p.tabellone_id and tb.tappa_id = p_tappa and p.fase = 'gironi';
  delete from public.gironi g
  using public.tabelloni tb
  where tb.id = g.tabellone_id and tb.tappa_id = p_tappa;

  for v_tabellone in
    select tb.id, tb.categoria
    from public.tabelloni tb
    where tb.tappa_id = p_tappa
    order by tb.categoria
  loop
    select * into v_esito
    from public.sorteggia_gironi_tabellone(v_tabellone.id);
    categoria := v_tabellone.categoria;
    gironi := v_esito.gironi;
    partite := v_esito.partite;
    esclusi := v_esito.esclusi;
    return next;
  end loop;
end;
$$;

-- avvia_fase: come prima, con la tappa di prova.
create or replace function public.avvia_fase(p_tabellone uuid)
returns table (
  partita_id uuid,
  girone_id uuid,
  girone_nome text,
  turno integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tappa uuid;
  v_stato public.stato_tappa;
  v_fase text;
  v_livello text;
  v_nuova text;
  v_problemi jsonb;
  v_girone record;
  v_partita record;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può avviare una fase'
      using errcode = 'insufficient_privilege';
  end if;

  select tb.tappa_id, tb.fase_gioco into v_tappa, v_fase
  from public.tabelloni tb
  where tb.id = p_tabellone
  for update;

  if not found then
    raise exception 'Tabellone non trovato.' using errcode = 'no_data_found';
  end if;

  select public.stato_di_gioco(t.stato, t.prova) into v_stato
  from public.tappe t where t.id = v_tappa;
  v_livello := public.livello_modificabile(p_tabellone);

  if v_fase is null then
    v_nuova := 'gironi_iniziali';
  elsif v_fase = 'gironi_iniziali' and v_livello = 'gold_silver' then
    v_nuova := 'gironi_gold_silver';
  else
    raise exception 'La fase di questo tabellone è già avviata'
      using errcode = 'check_violation', hint = 'fase_gia_avviata';
  end if;

  if v_stato not in ('iscrizioni_chiuse', 'in_corso')
    or (v_nuova <> 'gironi_iniziali' and v_stato <> 'in_corso') then
    raise exception 'La fase si avvia solo a iscrizioni chiuse'
      using errcode = 'check_violation', hint = 'tappa_non_avviabile';
  end if;

  if v_nuova = 'gironi_gold_silver'
    and not public.livello_concluso(p_tabellone, 'iniziale') then
    raise exception 'I gironi iniziali non sono ancora conclusi'
      using errcode = 'check_violation', hint = 'gironi_non_conclusi';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'regola', c.regola,
        'girone_id', c.girone_id,
        'girone_nome', c.girone_nome,
        'dettaglio', c.dettaglio
      )
    ),
    '[]'::jsonb
  )
  into v_problemi
  from public.controlli_avvio_fase(p_tabellone) c;

  if jsonb_array_length(v_problemi) > 0 then
    raise exception 'La fase non può partire: correggi i gironi'
      using errcode = 'check_violation',
        hint = 'avvio_bloccato',
        detail = v_problemi::text;
  end if;

  if exists (
    select 1
    from public.partite p
    join public.gironi g on g.id = p.girone_id
    left join public.punteggi pt on pt.partita_id = p.id
    where p.tabellone_id = p_tabellone
      and p.fase = 'gironi'
      and public.livello_girone(g.fase) = v_livello
      and (p.stato <> 'programmata' or jsonb_array_length(pt.sets) > 0)
  ) then
    raise exception 'Alcune partite dei gironi sono già iniziate'
      using errcode = 'check_violation', hint = 'partite_iniziate';
  end if;

  -- Only the matches of this level are recreated: the initial ones stay
  -- when the gold/silver groups start.
  delete from public.partite p
  using public.gironi g
  where g.id = p.girone_id
    and p.tabellone_id = p_tabellone
    and p.fase = 'gironi'
    and public.livello_girone(g.fase) = v_livello;
  if v_livello = 'iniziale' then
    delete from public.partite p
    where p.tabellone_id = p_tabellone and p.fase = 'gironi' and p.girone_id is null;
  end if;

  for v_girone in
    select g.id, g.nome
    from public.gironi g
    where g.tabellone_id = p_tabellone
      and public.livello_girone(g.fase) = v_livello
    order by g.posizione, g.nome
  loop
    for v_partita in
      select * from public.crea_partite_girone(p_tabellone, v_girone.id, 'gironi')
    loop
      partita_id := v_partita.partita_id;
      girone_id := v_girone.id;
      girone_nome := v_girone.nome;
      turno := v_partita.turno;
      return next;
    end loop;
  end loop;

  update public.tabelloni
  set fase_gioco = v_nuova, fase_avviata_il = now()
  where id = p_tabellone;

  update public.tappe
  set stato = 'in_corso'
  where id = v_tappa and stato = 'iscrizioni_chiuse';
end;
$$;

-- genera_finali: come prima, con la tappa di prova.
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

  select tb.fase_gioco, public.stato_di_gioco(t.stato, t.prova), tb.categoria = 'X'
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

-- concludi_tabellone: come prima, con la tappa di prova.
create or replace function public.concludi_tabellone(
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
    tb.concluso_il,
    public.stato_di_gioco(t.stato, t.prova) as stato
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

-- salva_punteggio: come prima, con la tappa di prova.
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
  select p.id, p.stato, p.fase, tb.fase_gioco, public.stato_di_gioco(t.stato, t.prova) as stato_tappa,
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

-- salva_parziale: come prima, con la tappa di prova.
create or replace function public.salva_parziale(
  p_partita uuid,
  p_versione integer,
  p_a integer,
  p_b integer,
  p_sovrascrivi boolean default false
)
returns table (versione integer, aggiornato_il timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_partita record;
  v_prima public.punteggi_parziali%rowtype;
  v_versione integer;
  v_ora timestamptz := now();
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può inviare il parziale'
      using errcode = 'insufficient_privilege';
  end if;

  -- Due invii contemporanei della stessa partita si mettono in coda.
  select p.id, p.stato, tb.tappa_id, public.stato_di_gioco(t.stato, t.prova) as stato_tappa
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
  if v_partita.stato_tappa <> 'in_corso' or v_partita.stato <> 'in_corso' then
    raise exception 'Il parziale si invia solo per una partita in corso'
      using errcode = 'check_violation', hint = 'partita_non_in_corso';
  end if;

  if p_a is null or p_b is null
    or p_a not between 0 and 99 or p_b not between 0 and 99 then
    raise exception 'Parziale non valido'
      using errcode = 'check_violation', hint = 'valori_non_validi';
  end if;

  select * into v_prima
  from public.punteggi_parziali pp
  where pp.partita_id = p_partita
  for update;

  if coalesce(v_prima.versione, 0) is distinct from p_versione then
    raise exception 'Il parziale è cambiato nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'parziale_superato',
        detail = coalesce(v_prima.versione, 0)::text;
  end if;

  v_versione := coalesce(v_prima.versione, 0) + 1;

  insert into public.punteggi_parziali as pp (
    partita_id, a, b, versione, aggiornato_da, aggiornato_il
  )
  values (p_partita, p_a, p_b, v_versione, (select auth.uid()), v_ora)
  on conflict (partita_id) do update
  set a = excluded.a,
      b = excluded.b,
      versione = excluded.versione,
      aggiornato_da = excluded.aggiornato_da,
      aggiornato_il = excluded.aggiornato_il;

  perform public.registra_evento(
    'punteggio_parziale',
    'punteggi',
    p_partita::text,
    jsonb_build_object(
      'parziale', case when v_prima.partita_id is null then null
        else jsonb_build_object('a', v_prima.a, 'b', v_prima.b) end,
      'versione', coalesce(v_prima.versione, 0),
      'tappa_id', v_partita.tappa_id
    ),
    jsonb_build_object(
      'parziale', jsonb_build_object('a', p_a, 'b', p_b),
      'versione', v_versione,
      'tappa_id', v_partita.tappa_id
    ),
    case when p_sovrascrivi then 'Sovrascrittura dopo conflitto' end
  );

  versione := v_versione;
  aggiornato_il := v_ora;
  return next;
end;
$$;

-- registra_ritiro_assenza: come prima, con la tappa di prova.
create or replace function public.registra_ritiro_assenza(
  p_iscrizione uuid,
  p_tipo text,
  p_partite jsonb,
  p_scelta text default null,
  p_conferma boolean default false,
  p_attesi integer default null
)
returns table (partite integer, scelta text, punteggi_persi integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iscrizione record;
  v_regola record;
  v_partita record;
  v_ids uuid[];
  v_trovate integer := 0;
  v_successive integer;
  v_persi integer;
  v_punteggi jsonb;
  v_prima_livello uuid;
  v_righe jsonb := '[]'::jsonb;
  v_nota text;
  v_nota_impatto text;
  v_a integer;
  v_b integer;
  v_dopo_sets jsonb;
  v_dopo_stato public.stato_partita;
  v_create integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può registrare un ritiro o un''assenza'
      using errcode = 'insufficient_privilege';
  end if;
  if p_tipo is null or p_tipo not in ('ritiro', 'assenza') then
    raise exception 'Tipo non valido: ritiro o assenza'
      using errcode = 'check_violation', hint = 'tipo_non_valido';
  end if;
  if p_scelta is not null and p_scelta not in ('mantieni', 'rigenera') then
    raise exception 'Scelta non valida'
      using errcode = 'check_violation', hint = 'scelta_non_valida';
  end if;
  if p_partite is null or jsonb_typeof(p_partite) <> 'array'
     or jsonb_array_length(p_partite) = 0 then
    raise exception 'Scegli almeno una partita'
      using errcode = 'check_violation', hint = 'partite_mancanti';
  end if;

  select i.id, i.tabellone_id, tb.tappa_id, public.stato_di_gioco(t.stato, t.prova) as stato_tappa,
    trim(u.nome || ' ' || u.cognome) as nome
  into v_iscrizione
  from public.iscrizioni i
  join public.tabelloni tb on tb.id = i.tabellone_id
  join public.tappe t on t.id = tb.tappa_id
  join public.utenti u on u.id = i.utente_id
  where i.id = p_iscrizione;
  if not found then
    raise exception 'Giocatore non trovato.' using errcode = 'no_data_found';
  end if;

  -- Same lock as correggi_punteggio / avvia_fase.
  perform 1 from public.tabelloni tb
  where tb.id = v_iscrizione.tabellone_id
  for update;

  if v_iscrizione.stato_tappa = 'archiviata' then
    raise exception 'La tappa è archiviata: i dati non si modificano più'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_iscrizione.stato_tappa <> 'in_corso' then
    raise exception 'Ritiri e assenze si registrano solo a tappa in corso'
      using errcode = 'check_violation', hint = 'tappa_non_in_corso';
  end if;

  v_ids := array(
    select distinct (e ->> 'partita_id')::uuid
    from jsonb_array_elements(p_partite) e
  );
  if cardinality(v_ids) <> jsonb_array_length(p_partite) then
    raise exception 'Una partita è indicata due volte'
      using errcode = 'check_violation', hint = 'partita_estranea';
  end if;

  for v_partita in
    select p.id, p.tabellone_id, p.stato, pg.squadra,
      pt.versione, (e ->> 'versione')::integer as attesa,
      exists (
        select 1 from public.assenze_partita a
        where a.partita_id = p.id and a.iscrizione_id = p_iscrizione
      ) as registrata
    from jsonb_array_elements(p_partite) e
    join public.partite p on p.id = (e ->> 'partita_id')::uuid
    left join public.partita_giocatori pg
      on pg.partita_id = p.id and pg.iscrizione_id = p_iscrizione
    left join public.punteggi pt on pt.partita_id = p.id
    for update of p
  loop
    if v_partita.tabellone_id <> v_iscrizione.tabellone_id
       or v_partita.squadra is null then
      raise exception 'Il giocatore non gioca questa partita'
        using errcode = 'check_violation', hint = 'partita_estranea';
    end if;
    if v_partita.stato = 'annullata' then
      raise exception 'La partita è già annullata'
        using errcode = 'check_violation', hint = 'partita_annullata';
    end if;
    if v_partita.registrata then
      raise exception 'Per questa partita il ritiro o l''assenza è già registrato'
        using errcode = 'check_violation', hint = 'gia_registrata';
    end if;
    if v_partita.versione is distinct from v_partita.attesa then
      raise exception 'Il punteggio è cambiato nel frattempo'
        using errcode = 'serialization_failure',
          hint = 'punteggio_cambiato',
          detail = coalesce(v_partita.versione, 0)::text;
    end if;
    v_trovate := v_trovate + 1;
  end loop;

  if v_trovate <> cardinality(v_ids) then
    raise exception 'Partita non trovata'
      using errcode = 'check_violation', hint = 'partita_estranea';
  end if;

  -- The next phase of the earliest level touched covers every later one.
  select x.id into v_prima_livello
  from unnest(v_ids) as x(id)
  where public.rango_partita(x.id) is not null
  order by public.rango_partita(x.id), x.id
  limit 1;

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
  from public.fase_successiva_correzione(v_prima_livello) f
  where v_prima_livello is not null
    and f.partita_id <> all (v_ids);

  perform public.controlla_impatto_fase(
    v_successive, v_persi, p_scelta, p_conferma, p_attesi
  );

  select * into v_regola from public.regola_ritiro();
  v_nota_impatto := public.nota_impatto_fase(v_successive, v_persi, p_scelta);
  v_nota := concat_ws(
    ' · ',
    case p_tipo when 'ritiro' then 'Ritiro di ' else 'Assenza di ' end
      || v_iscrizione.nome,
    v_nota_impatto
  );

  for v_partita in
    select p.id, p.stato, p.turno, pg.squadra, g.nome as girone,
      coalesce(pt.sets, '[]'::jsonb) as sets, pt.versione
    from unnest(v_ids) as x(id)
    join public.partite p on p.id = x.id
    join public.partita_giocatori pg
      on pg.partita_id = p.id and pg.iscrizione_id = p_iscrizione
    left join public.gironi g on g.id = p.girone_id
    left join public.punteggi pt on pt.partita_id = p.id
    order by public.rango_livello(g.fase), g.posizione nulls last, p.turno, p.id
  loop
    if v_regola.esito = 'tavolino' then
      if v_partita.squadra = 'A' then
        v_a := v_regola.punti_perdente;
        v_b := v_regola.punti_vincitore;
      else
        v_a := v_regola.punti_vincitore;
        v_b := v_regola.punti_perdente;
      end if;
      perform set_config('blvs.nota_registro', v_nota, true);
      perform 1 from public.salva_punteggio(
        v_partita.id, v_partita.versione, v_a, v_b
      );
      perform set_config('blvs.nota_registro', '', true);
      v_dopo_sets := jsonb_build_array(jsonb_build_object('a', v_a, 'b', v_b));
      v_dopo_stato := 'conclusa';
    else
      -- A score already saved is overwritten: a correction in the registro.
      if jsonb_array_length(v_partita.sets) > 0 then
        update public.punteggi pt
        set sets = '[]'::jsonb,
            versione = pt.versione + 1,
            aggiornato_da = (select auth.uid())
        where pt.partita_id = v_partita.id;

        perform public.registra_evento(
          'correzione_punteggio',
          'punteggi',
          v_partita.id::text,
          jsonb_build_object(
            'sets', v_partita.sets,
            'stato', v_partita.stato,
            'versione', v_partita.versione,
            'tappa_id', v_iscrizione.tappa_id
          ),
          jsonb_build_object(
            'sets', '[]'::jsonb,
            'stato', 'annullata',
            'versione', v_partita.versione + 1,
            'tappa_id', v_iscrizione.tappa_id
          ),
          v_nota
        );
      end if;

      update public.partite p
      set stato = 'annullata'
      where p.id = v_partita.id;
      v_dopo_sets := '[]'::jsonb;
      v_dopo_stato := 'annullata';
    end if;

    insert into public.assenze_partita (
      partita_id, iscrizione_id, tipo, esito, creato_da
    )
    values (
      v_partita.id, p_iscrizione, p_tipo, v_regola.esito, (select auth.uid())
    );

    v_righe := v_righe || jsonb_build_object(
      'partita_id', v_partita.id,
      'girone', v_partita.girone,
      'turno', v_partita.turno,
      'prima', jsonb_build_object('sets', v_partita.sets, 'stato', v_partita.stato),
      'dopo', jsonb_build_object('sets', v_dopo_sets, 'stato', v_dopo_stato)
    );
  end loop;

  perform public.registra_evento(
    p_tipo::public.tipo_evento_registro,
    'iscrizioni',
    p_iscrizione::text,
    jsonb_build_object(
      'tappa_id', v_iscrizione.tappa_id,
      'giocatore', v_iscrizione.nome,
      'partite', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'partita_id', r -> 'partita_id',
            'girone', r -> 'girone',
            'turno', r -> 'turno'
          ) || (r -> 'prima')
        ), '[]'::jsonb)
        from jsonb_array_elements(v_righe) r
      )
    ),
    jsonb_build_object(
      'tappa_id', v_iscrizione.tappa_id,
      'giocatore', v_iscrizione.nome,
      'regola', jsonb_build_object(
        'esito', v_regola.esito,
        'vincitore', v_regola.punti_vincitore,
        'perdente', v_regola.punti_perdente
      ),
      'partite', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'partita_id', r -> 'partita_id',
            'girone', r -> 'girone',
            'turno', r -> 'turno'
          ) || (r -> 'dopo')
        ), '[]'::jsonb)
        from jsonb_array_elements(v_righe) r
      )
    ),
    v_nota
  );

  if v_successive > 0 and p_scelta = 'rigenera' then
    perform public.elimina_fase_successiva(v_prima_livello);
    v_create := public.rigenera_fase_successiva(v_iscrizione.tabellone_id);

    perform public.registra_evento(
      'rigenerazione_gironi',
      'tabelloni',
      v_iscrizione.tabellone_id::text,
      jsonb_build_object(
        'tappa_id', v_iscrizione.tappa_id,
        'fase', 'successiva',
        'partite', v_successive,
        'punteggi_persi', v_persi,
        'punteggi', v_punteggi
      ),
      jsonb_build_object(
        'tappa_id', v_iscrizione.tappa_id,
        'fase', 'successiva',
        'partite', coalesce(v_create, 0),
        'punteggi_persi', v_persi,
        p_tipo || '_di', p_iscrizione
      ),
      'Fase successiva rigenerata dopo ' ||
        case p_tipo when 'ritiro' then 'un ritiro' else 'un''assenza' end
        || ': ' || v_persi
        || case when v_persi = 1 then ' punteggio perso' else ' punteggi persi' end
    );
  end if;

  partite := v_trovate;
  scelta := case when v_successive > 0 then p_scelta end;
  punteggi_persi := case when p_scelta = 'rigenera' then v_persi else 0 end;
  return next;
end;
$$;

-- tabellone_giocatore_dati: come prima, con la tappa di prova.
create or replace function public.tabellone_giocatore_dati(p_tappa uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with tappa as (
    select t.id, t.nome, public.stato_di_gioco(t.stato, t.prova) as stato
    from public.tappe t
    where t.id = p_tappa
      -- Tappa di prova: in bozza la vede solo l'admin.
      and (t.stato <> 'bozza' or (t.prova and public.is_admin()))
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
