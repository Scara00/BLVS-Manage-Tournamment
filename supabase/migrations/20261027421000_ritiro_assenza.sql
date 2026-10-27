-- BLVS-42 · Ritiro o assenza (R-35, R-37).
--
-- L'admin sceglie un giocatore, le sue partite e il tipo (ritiro o
-- assenza). A ogni partita si applica la regola configurabile Q-09
-- (`regola_ritiro()`): per ora la partita è ANNULLATA, quindi esce dalla
-- classifica del girone (BLVS-27 salta le partite `annullata`). Una partita
-- già conclusa perde il suo punteggio, scritto nel registro come
-- correzione. L'iscrizione resta com'è (decisione del cliente): il
-- giocatore resta nel suo girone e nella classifica.
--
-- Se la fase successiva del tabellone esiste già, la registrazione aspetta
-- «Mantieni»/«Rigenera» come la correzione di BLVS-41. Questa migrazione
-- allinea anche la «fase successiva» ai gironi gold/silver di BLVS-39:
--   * fase_successiva_correzione(): le partite dei livelli successivi a
--     quello della partita (iniziale → gold/silver → finali);
--   * elimina_fase_successiva(): «Rigenera» elimina quei gironi e quelle
--     partite e riporta il tabellone alla fase della partita;
--   * correggi_punteggio(): stesso contratto, usa le due funzioni.

-- ---------------------------------------------------------------------------
-- Regola configurabile (Q-09)
-- ---------------------------------------------------------------------------

-- TODO(Q-09): da confermare col cliente. Mirror di REGOLA_RITIRO in
-- src/lib/ritiri/regola.ts: cambiale insieme (un test PGlite le confronta).
--   esito 'annulla'  → la partita diventa `annullata` (fuori classifica);
--   esito 'tavolino' → la squadra del giocatore perde
--                      punti_perdente–punti_vincitore.
create function public.regola_ritiro()
returns table (esito text, punti_vincitore integer, punti_perdente integer)
language sql
immutable
set search_path = ''
as $$
  select 'annulla'::text, 21, 0;
$$;

grant execute on function public.regola_ritiro() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Assenze registrate
-- ---------------------------------------------------------------------------

-- Una riga per giocatore e partita: la classifica la mostra a testo
-- («Ritirato», «Assente in 1 partita») e una partita non si registra due
-- volte. Scritta solo da `registra_ritiro_assenza`.
create table public.assenze_partita (
  partita_id uuid not null references public.partite (id) on delete cascade,
  iscrizione_id uuid not null references public.iscrizioni (id) on delete cascade,
  tipo text not null check (tipo in ('ritiro', 'assenza')),
  esito text not null check (esito in ('annulla', 'tavolino')),
  creato_da uuid references public.utenti (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (partita_id, iscrizione_id)
);

create index assenze_partita_iscrizione_idx
  on public.assenze_partita (iscrizione_id);

alter table public.assenze_partita enable row level security;

create policy assenze_partita_select on public.assenze_partita
for select to authenticated
using ((select public.is_admin()));
create policy assenze_partita_insert on public.assenze_partita
for insert to authenticated
with check ((select public.is_admin()));

grant select, insert on public.assenze_partita to authenticated;

-- ---------------------------------------------------------------------------
-- Livelli e fase successiva (BLVS-39)
-- ---------------------------------------------------------------------------

-- 1 gironi iniziali, 2 gold/silver, 3 finali. A match without a group
-- (fase eliminazione/finale before BLVS-39) counts as the last level.
create function public.rango_livello(p_fase_girone text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_fase_girone is null then 3
    when public.livello_girone(p_fase_girone) = 'iniziale' then 1
    when public.livello_girone(p_fase_girone) = 'gold_silver' then 2
    else 3
  end;
$$;

grant execute on function public.rango_livello(text) to authenticated;

-- The level of a group match (1 or 2), null for a match that has no next
-- phase (finals, eliminazione).
create function public.rango_partita(p_partita uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select case
    when p.fase <> 'gironi' then null
    else public.rango_livello(coalesce(g.fase, 'iniziale'))
  end
  from public.partite p
  left join public.gironi g on g.id = p.girone_id
  where p.id = p_partita;
$$;

grant execute on function public.rango_partita(uuid) to authenticated;

-- Redefined with the group name: gold/silver matches are `fase = 'gironi'`
-- and are told apart by their group.
drop function public.fase_successiva_correzione(uuid);

create function public.fase_successiva_correzione(p_partita uuid)
returns table (
  partita_id uuid,
  fase text,
  turno integer,
  stato public.stato_partita,
  sets jsonb,
  squadra_a text[],
  squadra_b text[],
  girone text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tabellone uuid;
  v_rango integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può correggere i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  select p.tabellone_id, public.rango_partita(p.id)
  into v_tabellone, v_rango
  from public.partite p
  where p.id = p_partita;
  if v_rango is null then
    return;
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
    ),
    g.nome
  from public.partite p
  left join public.gironi g on g.id = p.girone_id
  left join public.punteggi pt on pt.partita_id = p.id
  left join public.partita_giocatori pg on pg.partita_id = p.id
  left join public.iscrizioni i on i.id = pg.iscrizione_id
  left join public.utenti u on u.id = i.utente_id
  where p.tabellone_id = v_tabellone
    and public.rango_livello(case when p.girone_id is null then null else g.fase end)
      > v_rango
  group by p.id, p.fase, p.turno, p.stato, p.girone_id, pt.sets, g.nome, g.fase, g.posizione
  order by
    public.rango_livello(case when p.girone_id is null then null else g.fase end),
    g.posizione nulls last,
    p.turno,
    p.id;
end;
$$;

revoke all on function public.fase_successiva_correzione(uuid) from public, anon;
grant execute on function public.fase_successiva_correzione(uuid) to authenticated;

-- «Rigenera»: deletes the levels after the one of `p_partita` (their
-- groups, with players and matches, and any match without a group), moves
-- the board back to that level's game phase and bumps `versione_gironi`
-- (BLVS-28 editors open elsewhere get a conflict). The next phase is then
-- proposed again from the new standings (BLVS-39). Returns the number of
-- matches deleted.
create function public.elimina_fase_successiva(p_partita uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tabellone uuid;
  v_rango integer;
  v_partite integer;
begin
  select p.tabellone_id, public.rango_partita(p.id)
  into v_tabellone, v_rango
  from public.partite p
  where p.id = p_partita;
  if v_rango is null then
    return 0;
  end if;

  with eliminate as (
    delete from public.partite p
    where p.tabellone_id = v_tabellone
      and public.rango_livello((
        select g.fase from public.gironi g where g.id = p.girone_id
      )) > v_rango
    returning p.id
  )
  select count(*)::integer into v_partite from eliminate;

  delete from public.gironi g
  where g.tabellone_id = v_tabellone
    and public.rango_livello(g.fase) > v_rango;

  update public.tabelloni tb
  set fase_gioco = case v_rango
        when 1 then 'gironi_iniziali'
        else 'gironi_gold_silver'
      end,
      versione_gironi = tb.versione_gironi + 1
  where tb.id = v_tabellone;

  return v_partite;
end;
$$;

revoke all on function public.elimina_fase_successiva(uuid) from public, anon;
grant execute on function public.elimina_fase_successiva(uuid) to authenticated;

-- The impact checks shared by the correction and the withdrawal, given
-- what the admin is about to change: N next-phase matches, P of them with
-- a score. Raises (23514 unless noted):
--   impatto_richiesto        N > 0 and no choice (detail = P)
--   40001 punteggi_cambiati  P ≠ p_attesi (detail = P)
--   conferma_richiesta       «Rigenera» with P > 0 and no tick
--   scelta_non_valida        p_scelta not mantieni/rigenera
create function public.controlla_impatto_fase(
  p_successive integer,
  p_persi integer,
  p_scelta text,
  p_conferma boolean,
  p_attesi integer
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_scelta is not null and p_scelta not in ('mantieni', 'rigenera') then
    raise exception 'Scelta non valida'
      using errcode = 'check_violation', hint = 'scelta_non_valida';
  end if;
  if p_successive = 0 then
    return;
  end if;
  if p_scelta is null then
    raise exception 'La fase successiva è già generata: scegli se mantenerla o rigenerarla'
      using errcode = 'check_violation',
        hint = 'impatto_richiesto',
        detail = p_persi::text;
  end if;
  if p_attesi is distinct from p_persi then
    raise exception 'La fase successiva è cambiata nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'punteggi_cambiati',
        detail = p_persi::text;
  end if;
  if p_scelta = 'rigenera' and p_persi > 0 and not coalesce(p_conferma, false) then
    raise exception 'Conferma che si perdono i punteggi della fase successiva'
      using errcode = 'check_violation',
        hint = 'conferma_richiesta',
        detail = p_persi::text;
  end if;
end;
$$;

grant execute on function public.controlla_impatto_fase(integer, integer, text, boolean, integer)
  to authenticated;

-- «Fase successiva rigenerata con 2 punteggi persi» and the like.
create function public.nota_impatto_fase(
  p_successive integer,
  p_persi integer,
  p_scelta text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_successive = 0 then null
    when p_scelta = 'mantieni' then 'Fase successiva mantenuta'
    when p_persi = 0 then 'Fase successiva rigenerata'
    else 'Fase successiva rigenerata con ' || p_persi
      || case when p_persi = 1 then ' punteggio perso' else ' punteggi persi' end
  end;
$$;

grant execute on function public.nota_impatto_fase(integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Correzione (BLVS-41) con i livelli di BLVS-39
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

  v_nota := concat_ws(
    ' · ',
    case when p_sovrascrivi then 'Sovrascrittura dopo conflitto' end,
    public.nota_impatto_fase(v_successive, v_persi, p_scelta)
  );
  perform set_config('blvs.nota_registro', coalesce(v_nota, ''), true);

  select s.versione, s.tipo into v_salvato
  from public.salva_punteggio(p_partita, p_versione, p_a, p_b) s;

  perform set_config('blvs.nota_registro', '', true);

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

-- ---------------------------------------------------------------------------
-- Registrazione di un ritiro o di un'assenza
-- ---------------------------------------------------------------------------

-- p_partite: [{partita_id, versione}], the matches the admin ticked, each
-- with the `punteggi.versione` the preview was based on.
-- p_scelta / p_conferma / p_attesi: as in `correggi_punteggio`.
--
-- Errors (23514 unless noted), with hint:
--   42501                    not an admin
--   P0002                    unknown registration
--   tipo_non_valido          p_tipo is not ritiro/assenza
--   partite_mancanti         no match given
--   partita_estranea         a match of another board, without the player,
--                            not found or given twice
--   partita_annullata        a match already voided
--   gia_registrata           an absence is already recorded for that match
--   tappa_archiviata
--   tappa_non_in_corso       the stage is not in progress
--   40001 punteggio_cambiato a match's score changed since the preview
--                            (detail = current version)
--   impatto_richiesto, conferma_richiesta, 40001 punteggi_cambiati,
--   scelta_non_valida        see `controlla_impatto_fase`
create function public.registra_ritiro_assenza(
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

  select i.id, i.tabellone_id, tb.tappa_id, t.stato as stato_tappa,
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

revoke all on function public.registra_ritiro_assenza(uuid, text, jsonb, text, boolean, integer)
  from public, anon;
grant execute on function public.registra_ritiro_assenza(uuid, text, jsonb, text, boolean, integer)
  to authenticated;
