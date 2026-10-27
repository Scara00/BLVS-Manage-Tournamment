-- BLVS-35 · Registro dei punteggi di una tappa (w-admin-registro, R-35).
-- Sola lettura: le voci sono gli eventi di gara scritti da registra_evento()
-- (BLVS-08), cioè le righe di public.registro con `tipo` non nullo. Le righe
-- tecniche dei trigger (tipo null) non compaiono.
--
-- Una voce appartiene a una tappa secondo la sua `entita`:
--   punteggi / partite   entita_id = partita_id → partite.tabellone_id
--   tabelloni            entita_id = tabellone_id
--   gironi               entita_id = girone_id → gironi.tabellone_id
--   iscrizioni           entita_id = iscrizione_id → iscrizioni.tappa_id
--   tappe                entita_id = tappa_id
-- Se la riga collegata non esiste più (es. partite cancellate da una
-- rigenerazione) vale la chiave `tappa_id` (e `partita_id`) di valore_dopo
-- o valore_prima, quando chi scrive l'evento la include.

create function public.uuid_o_null(p_testo text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_testo ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then p_testo::uuid
  end;
$$;

-- Tutte le voci di gara della tappa, con la partita a cui si riferiscono.
-- Security invoker: la RLS di registro le mostra solo all'admin.
create function public.voci_registro_tappa(p_tappa uuid)
returns table (
  id bigint,
  tipo public.tipo_evento_registro,
  created_at timestamptz,
  attore_id uuid,
  partita_id uuid,
  valore_prima jsonb,
  valore_dopo jsonb,
  nota text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with voci as (
    select
      r.*,
      public.uuid_o_null(r.entita_id) as rif,
      public.uuid_o_null(coalesce(
        r.valore_dopo ->> 'tappa_id', r.valore_prima ->> 'tappa_id'
      )) as tappa_dichiarata,
      public.uuid_o_null(coalesce(
        r.valore_dopo ->> 'partita_id', r.valore_prima ->> 'partita_id'
      )) as partita_dichiarata
    from public.registro r
    where r.tipo is not null
  ),
  collegate as (
    select
      v.*,
      case when v.entita in ('punteggi', 'partite') then v.rif
        else v.partita_dichiarata end as partita,
      coalesce(
        case v.entita
          when 'tappe' then v.rif
          when 'tabelloni' then
            (select tb.tappa_id from public.tabelloni tb where tb.id = v.rif)
          when 'iscrizioni' then
            (select i.tappa_id from public.iscrizioni i where i.id = v.rif)
          when 'gironi' then
            (select tb.tappa_id from public.gironi g
             join public.tabelloni tb on tb.id = g.tabellone_id
             where g.id = v.rif)
        end,
        (select tb.tappa_id from public.partite p
         join public.tabelloni tb on tb.id = p.tabellone_id
         where p.id = case when v.entita in ('punteggi', 'partite') then v.rif
           else v.partita_dichiarata end),
        v.tappa_dichiarata
      ) as tappa
    from voci v
  )
  select c.id, c.tipo, c.created_at, c.attore_id, c.partita,
         c.valore_prima, c.valore_dopo, c.nota
  from collegate c
  where c.tappa = p_tappa;
$$;

-- La partita come la legge il registro: categoria, fase, girone, turno e i
-- giocatori delle due squadre.
create function public.partita_registro(p_partita uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'categoria', tb.categoria,
    'fase', p.fase,
    'girone', g.nome,
    'turno', p.turno,
    'squadra_a', coalesce(
      (select jsonb_agg(u.nome || ' ' || u.cognome order by u.cognome, u.nome)
       from public.partita_giocatori pg
       join public.iscrizioni i on i.id = pg.iscrizione_id
       join public.utenti u on u.id = i.utente_id
       where pg.partita_id = p.id and pg.squadra = 'A'),
      '[]'::jsonb),
    'squadra_b', coalesce(
      (select jsonb_agg(u.nome || ' ' || u.cognome order by u.cognome, u.nome)
       from public.partita_giocatori pg
       join public.iscrizioni i on i.id = pg.iscrizione_id
       join public.utenti u on u.id = i.utente_id
       where pg.partita_id = p.id and pg.squadra = 'B'),
      '[]'::jsonb)
  )
  from public.partite p
  join public.tabelloni tb on tb.id = p.tabellone_id
  left join public.gironi g on g.id = p.girone_id
  where p.id = p_partita;
$$;

-- ---------------------------------------------------------------------------
-- RPC: una pagina del registro della tappa, dalla più recente
-- ---------------------------------------------------------------------------

-- p_prima_di: id dell'ultima voce già mostrata («Mostra le N voci
-- precedenti»); null = dalla più recente. `totale` conta le voci che
-- rispettano i filtri a partire dal cursore, comprese quelle restituite:
-- le precedenti ancora da caricare sono totale - righe restituite.
create function public.registro_tappa(
  p_tappa uuid,
  p_tipo public.tipo_evento_registro default null,
  p_partita uuid default null,
  p_prima_di bigint default null,
  p_limite integer default 30
)
returns table (
  id bigint,
  tipo public.tipo_evento_registro,
  created_at timestamptz,
  autore text,
  partita_id uuid,
  partita jsonb,
  valore_prima jsonb,
  valore_dopo jsonb,
  nota text,
  totale bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_cursore public.registro;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può leggere il registro'
      using errcode = 'insufficient_privilege';
  end if;

  if p_prima_di is not null then
    select * into v_cursore from public.registro r where r.id = p_prima_di;
  end if;

  return query
  with filtrate as (
    select v.*
    from public.voci_registro_tappa(p_tappa) v
    where (p_tipo is null or v.tipo = p_tipo)
      and (p_partita is null or v.partita_id = p_partita)
      and (
        v_cursore.id is null
        or (v.created_at, v.id) < (v_cursore.created_at, v_cursore.id)
      )
  ),
  pagina as (
    select f.*, count(*) over () as totale
    from filtrate f
    order by f.created_at desc, f.id desc
    limit greatest(1, least(coalesce(p_limite, 30), 200))
  )
  select
    pg.id,
    pg.tipo,
    pg.created_at,
    nullif(btrim(coalesce(u.nome, '') || ' ' || coalesce(u.cognome, '')), ''),
    pg.partita_id,
    case when pg.partita_id is not null
      then public.partita_registro(pg.partita_id) end,
    pg.valore_prima,
    pg.valore_dopo,
    pg.nota,
    pg.totale
  from pagina pg
  left join public.utenti u on u.id = pg.attore_id
  order by pg.created_at desc, pg.id desc;
end;
$$;

-- Le partite che hanno almeno una voce, per il filtro «Partita».
create function public.partite_registro_tappa(p_tappa uuid)
returns table (partita_id uuid, partita jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può leggere il registro'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select distinct on (v.partita_id) v.partita_id,
         public.partita_registro(v.partita_id)
  from public.voci_registro_tappa(p_tappa) v
  where v.partita_id is not null
  order by v.partita_id;
end;
$$;

revoke all on function public.uuid_o_null(text) from public, anon;
revoke all on function public.voci_registro_tappa(uuid) from public, anon;
revoke all on function public.partita_registro(uuid) from public, anon;
revoke all on function public.registro_tappa(
  uuid, public.tipo_evento_registro, uuid, bigint, integer
) from public, anon;
revoke all on function public.partite_registro_tappa(uuid) from public, anon;
grant execute on function public.uuid_o_null(text) to authenticated;
grant execute on function public.voci_registro_tappa(uuid) to authenticated;
grant execute on function public.partita_registro(uuid) to authenticated;
grant execute on function public.registro_tappa(
  uuid, public.tipo_evento_registro, uuid, bigint, integer
) to authenticated;
grant execute on function public.partite_registro_tappa(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Parità risolta (BLVS-27) come evento di gara
-- ---------------------------------------------------------------------------

-- Come prima, più l'evento `parita_risolta` (entita `gironi`): valore_prima
-- è l'ordine deciso in precedenza per la stessa firma (null la prima volta),
-- valore_dopo l'ordine nuovo con i nomi dei giocatori; la nota è il motivo.
create or replace function public.risolvi_parita_girone(
  p_girone uuid,
  p_firma text,
  p_ordine uuid[],
  p_motivo text
)
returns public.spareggi_girone
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_firma uuid[];
  v_prima public.spareggi_girone;
  v_riga public.spareggi_girone;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può decidere una parità'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.gironi where id = p_girone) then
    raise exception 'Girone non trovato'
      using errcode = 'no_data_found', hint = 'girone_non_trovato';
  end if;

  if v_motivo is null then
    raise exception 'Scrivi come è stata decisa la parità'
      using errcode = 'check_violation', hint = 'motivo_mancante';
  end if;

  begin
    select array_agg(split_part(parte, ':', 1)::uuid)
    into v_firma
    from unnest(string_to_array(coalesce(p_firma, ''), '|')) parte;
  exception when invalid_text_representation then
    v_firma := null;
  end;

  if p_ordine is null
     or cardinality(p_ordine) < 2
     or v_firma is null
     or cardinality(p_ordine) <> cardinality(v_firma)
     or (select count(distinct x) from unnest(p_ordine) x) <> cardinality(p_ordine)
     or not (p_ordine <@ v_firma and v_firma <@ p_ordine)
     or (
       select count(*)
       from public.girone_iscrizioni gi
       where gi.girone_id = p_girone and gi.iscrizione_id = any (p_ordine)
     ) <> cardinality(p_ordine)
  then
    raise exception 'L''ordine deve elencare una volta ciascun giocatore pari del girone'
      using errcode = 'check_violation', hint = 'ordine_non_valido';
  end if;

  select * into v_prima
  from public.spareggi_girone s
  where s.girone_id = p_girone and s.firma = p_firma;

  insert into public.spareggi_girone (girone_id, firma, ordine, motivo)
  values (p_girone, p_firma, p_ordine, v_motivo)
  on conflict (girone_id, firma) do update
    set ordine = excluded.ordine,
        motivo = excluded.motivo,
        deciso_da = auth.uid(),
        deciso_il = now()
  returning * into v_riga;

  perform public.registra_evento(
    'parita_risolta',
    'gironi',
    p_girone::text,
    case when v_prima.id is not null then jsonb_build_object(
      'ordine', public.nomi_iscrizioni(v_prima.ordine),
      'motivo', v_prima.motivo
    ) end,
    jsonb_build_object(
      'girone', (select g.nome from public.gironi g where g.id = p_girone),
      'firma', p_firma,
      'ordine', public.nomi_iscrizioni(p_ordine)
    ),
    left(v_motivo, 500)
  );

  return v_riga;
end;
$$;

-- «Nome Cognome» delle iscrizioni, nello stesso ordine.
create function public.nomi_iscrizioni(p_iscrizioni uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      coalesce(u.nome || ' ' || u.cognome, x.id::text) order by x.n
    ),
    '[]'::jsonb
  )
  from unnest(p_iscrizioni) with ordinality as x (id, n)
  left join public.iscrizioni i on i.id = x.id
  left join public.utenti u on u.id = i.utente_id;
$$;

revoke all on function public.nomi_iscrizioni(uuid[]) from public, anon;
grant execute on function public.nomi_iscrizioni(uuid[]) to authenticated;
