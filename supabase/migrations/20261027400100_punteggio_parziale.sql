-- BLVS-37 · Punteggio parziale in tempo reale (R-38, R-48, R-70, R-71).
--
-- Mentre una partita è `in_corso` l'admin manda il parziale (per esempio
-- 14-11) ai giocatori. Il parziale NON è il punteggio: vive in una tabella
-- a sé, quindi non tocca `punteggi` (né la sua versione, né la classifica
-- di BLVS-27, né il conteggio delle partite da inserire). Ha una propria
-- versione: due admin che mandano il parziale della stessa partita
-- finiscono nel dialogo di conflitto come per il punteggio (BLVS-34).
-- Ogni invio scrive nel registro `punteggio_parziale` (entita `punteggi`,
-- entita_id = partita_id, come gli altri eventi dei punteggi).
-- Quando la partita lascia `in_corso` (conclusa, annullata, …) il
-- parziale si cancella.

create table public.punteggi_parziali (
  partita_id uuid primary key references public.partite (id) on delete cascade,
  a integer not null check (a between 0 and 99),
  b integer not null check (b between 0 and 99),
  -- Concorrenza ottimistica: 0 = nessun parziale, poi +1 a ogni invio.
  versione integer not null check (versione >= 1),
  aggiornato_da uuid references public.utenti (id) on delete set null,
  aggiornato_il timestamptz not null default now()
);

alter table public.punteggi_parziali enable row level security;

-- Lo legge solo l'admin: i giocatori lo ricevono dal canale live.
create policy punteggi_parziali_select on public.punteggi_parziali
for select to authenticated
using ((select public.is_admin()));
create policy punteggi_parziali_insert on public.punteggi_parziali
for insert to authenticated
with check ((select public.is_admin()));
create policy punteggi_parziali_update on public.punteggi_parziali
for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));
create policy punteggi_parziali_delete on public.punteggi_parziali
for delete to authenticated
using ((select public.is_admin()));

grant select, insert, update, delete on public.punteggi_parziali to authenticated;

-- ---------------------------------------------------------------------------
-- Invio del parziale
-- ---------------------------------------------------------------------------

-- Errori:
-- - 42501 per chi non è admin;
-- - 23514 hint `tappa_archiviata` | `partita_non_in_corso` (la tappa o la
--   partita non è `in_corso`) | `valori_non_validi` (interi da 0 a 99; il
--   pareggio è ammesso e la regola del set non vale per un parziale);
-- - 40001 hint `parziale_superato`, detail = versione attuale, quando
--   `p_versione` non è quella attuale (0 = nessun parziale ancora).
-- `p_sovrascrivi` scrive solo la nota nel registro: la versione resta
-- controllata, quindi si sovrascrive solo il valore visto nel dialogo.
create function public.salva_parziale(
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
  select p.id, p.stato, tb.tappa_id, t.stato as stato_tappa
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

revoke all on function public.salva_parziale(uuid, integer, integer, integer, boolean)
  from public, anon;
grant execute on function public.salva_parziale(uuid, integer, integer, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Parziale attuale (dialogo di conflitto)
-- ---------------------------------------------------------------------------

-- Nessuna riga quando la partita non ha un parziale.
create function public.parziale_attuale(p_partita uuid)
returns table (
  versione integer,
  a integer,
  b integer,
  autore text,
  aggiornato_il timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può leggere il parziale'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pp.versione,
    pp.a,
    pp.b,
    nullif(trim(concat_ws(' ', u.nome, u.cognome)), ''),
    pp.aggiornato_il
  from public.punteggi_parziali pp
  left join public.utenti u on u.id = pp.aggiornato_da
  where pp.partita_id = p_partita;
end;
$$;

revoke all on function public.parziale_attuale(uuid) from public, anon;
grant execute on function public.parziale_attuale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Il parziale finisce con la partita
-- ---------------------------------------------------------------------------

-- Qualunque percorso porti la partita fuori da `in_corso` (salva_punteggio,
-- «Concludi» di BLVS-31, annullamento) cancella il parziale, senza toccare
-- quelle funzioni. Security definer: vale anche per chi scrive senza la
-- policy di delete (backend, seed).
create function public.cancella_parziale_partita()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.punteggi_parziali pp where pp.partita_id = new.id;
  return null;
end;
$$;

create trigger partite_cancella_parziale
after update of stato on public.partite
for each row
when (old.stato = 'in_corso' and new.stato is distinct from 'in_corso')
execute function public.cancella_parziale_partita();
