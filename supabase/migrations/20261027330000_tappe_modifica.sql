-- BLVS-21 · Modifica dei dati di una tappa (w-admin-tappa-modifica).
--
-- - `tappe.versione` per la concorrenza ottimistica: ogni UPDATE la porta a
--   +1 da solo, così anche i cambi di stato (BLVS-20) e i job la fanno
--   crescere. Chi salva un modulo la confronta con quella letta.
-- - Il massimo di un tabellone (`posti`, BLVS-17/19) non può scendere sotto
--   gli iscritti attivi (in attesa + confermati) di quel tabellone.
-- - `modifica_tappa()` salva dati della tappa e massimi M/F in una sola
--   transazione, con gli stessi controlli del modulo.

-- `if not exists`: anche BLVS-17 e BLVS-19 introducono `tabelloni.posti`.
alter table public.tabelloni
  add column if not exists posti integer;

alter table public.tabelloni
  alter column posti set default 16;

update public.tabelloni set posti = 16 where posti is null;

-- ---------------------------------------------------------------------------
-- Versione della tappa
-- ---------------------------------------------------------------------------

alter table public.tappe
  add column versione integer not null default 1
    constraint tappe_versione check (versione >= 1);

comment on column public.tappe.versione is
  'Cresce di 1 a ogni modifica: chi salva un modulo confronta quella letta.';

create function public.incrementa_versione_tappa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.versione := old.versione + 1;
  return new;
end;
$$;

create trigger tappe_versione
before update on public.tappe
for each row execute function public.incrementa_versione_tappa();

-- ---------------------------------------------------------------------------
-- Iscritti attivi e massimo del tabellone
-- ---------------------------------------------------------------------------

-- Security definer: conta anche le iscrizioni che chi chiama non vede.
create function public.iscritti_tabellone(p_tabellone uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.iscrizioni
  where tabellone_id = p_tabellone
    and stato in ('in_attesa', 'confermata');
$$;

revoke execute on function public.iscritti_tabellone(uuid) from public, anon;
grant execute on function public.iscritti_tabellone(uuid) to authenticated, service_role;

create function public.blocca_posti_sotto_iscritti()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iscritti integer;
begin
  if new.posti is null or new.posti is not distinct from old.posti then
    return new;
  end if;
  v_iscritti := public.iscritti_tabellone(new.id);
  if new.posti < v_iscritti then
    raise exception 'Il massimo non può scendere sotto %', v_iscritti
      using errcode = 'check_violation',
        hint = 'posti_sotto_iscritti',
        detail = new.categoria::text || ':' || v_iscritti;
  end if;
  return new;
end;
$$;

create trigger tabelloni_posti_minimo
before update of posti on public.tabelloni
for each row execute function public.blocca_posti_sotto_iscritti();

-- ---------------------------------------------------------------------------
-- Salvataggio del modulo
-- ---------------------------------------------------------------------------

-- Una tappa in corso, conclusa o annullata non si modifica più da qui. Se
-- cambia la data, la tappa si sposta tutta (la durata resta la stessa).
-- Security invoker: valgono le policy RLS dell'admin. Restituisce la nuova
-- versione.
create function public.modifica_tappa(
  p_id uuid,
  p_versione integer,
  p_nome text,
  p_luogo text,
  p_data date,
  p_scadenza timestamptz,
  p_posti_m integer,
  p_posti_f integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tappa public.tappe;
  v_versione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può modificare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_tappa from public.tappe where id = p_id for update;
  if not found then
    raise exception 'Tappa non trovata' using errcode = 'no_data_found';
  end if;

  if v_tappa.versione <> p_versione then
    raise exception 'La tappa è stata modificata nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = v_tappa.versione::text;
  end if;

  if v_tappa.stato in ('in_corso', 'conclusa', 'annullata') then
    raise exception 'Una tappa % non si può più modificare', v_tappa.stato
      using errcode = 'check_violation', hint = 'tappa_non_modificabile';
  end if;

  -- Data e scadenza già passate restano valide finché non le si cambia.
  if p_data <> v_tappa.data_inizio
    and p_data <= (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data della tappa deve essere futura'
      using errcode = 'check_violation', hint = 'data_passata';
  end if;

  if p_scadenza is distinct from v_tappa.iscrizioni_chiudono_il
    and p_scadenza <= now() then
    raise exception 'La scadenza delle iscrizioni deve essere futura'
      using errcode = 'check_violation', hint = 'scadenza_passata';
  end if;

  if p_scadenza >= (p_data::timestamp at time zone 'Europe/Rome') then
    raise exception 'La scadenza deve precedere la data della tappa'
      using errcode = 'check_violation', hint = 'scadenza_dopo_tappa';
  end if;

  update public.tappe
  set nome = p_nome,
    luogo = p_luogo,
    data_inizio = p_data,
    data_fine = p_data + (v_tappa.data_fine - v_tappa.data_inizio),
    iscrizioni_chiudono_il = p_scadenza
  where id = p_id
  returning versione into v_versione;

  update public.tabelloni
  set posti = case categoria when 'M' then p_posti_m else p_posti_f end
  where tappa_id = p_id
    and posti is distinct from
      case categoria when 'M' then p_posti_m else p_posti_f end;

  return v_versione;
end;
$$;

revoke all on function public.modifica_tappa(uuid, integer, text, text, date, timestamptz, integer, integer) from public, anon;
grant execute on function public.modifica_tappa(uuid, integer, text, text, date, timestamptz, integer, integer) to authenticated;
