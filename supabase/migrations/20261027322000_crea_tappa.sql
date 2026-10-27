-- BLVS-19 · Creazione di una tappa (w-admin-tappa-nuova).
--
-- Ogni tabellone ha il suo numero massimo di iscritti (`posti`): M e F sono
-- indipendenti. La tappa nasce in bozza con un solo giorno di gioco e una
-- scadenza delle iscrizioni che cade prima dell'inizio (ora italiana).

-- La colonna `posti` (posti per tabellone, default 16) la introduce anche
-- BLVS-17 (20261027317000_admin_dashboard_tappe.sql): `if not exists` per
-- funzionare in entrambi gli ordini. Il minimo di 4 iscritti (un girone)
-- lo impone `crea_tappa`, non un vincolo sulla colonna.
alter table public.tabelloni
  add column if not exists posti integer not null default 16;

-- Le iscrizioni chiudono prima della mezzanotte (Europe/Rome) del primo giorno.
alter table public.tappe
  add constraint tappe_scadenza_prima_della_tappa check (
    iscrizioni_chiudono_il is null
    or iscrizioni_chiudono_il < (data_inizio::timestamp at time zone 'Europe/Rome')
  );

-- Crea la tappa in bozza e imposta i posti dei due tabelloni, in una sola
-- transazione. Security invoker: valgono le policy RLS dell'admin.
create function public.crea_tappa(
  p_nome text,
  p_luogo text,
  p_data date,
  p_scadenza timestamptz,
  p_posti_m integer,
  p_posti_f integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può creare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  if p_data <= (now() at time zone 'Europe/Rome')::date then
    raise exception 'La data della tappa deve essere futura'
      using errcode = 'check_violation', hint = 'data_passata';
  end if;

  if p_posti_m is null or p_posti_f is null
     or p_posti_m not between 4 and 256 or p_posti_f not between 4 and 256 then
    raise exception 'Ogni tabellone ha tra 4 e 256 posti'
      using errcode = 'check_violation', hint = 'posti';
  end if;

  if p_scadenza <= now() then
    raise exception 'La scadenza delle iscrizioni deve essere futura'
      using errcode = 'check_violation', hint = 'scadenza_passata';
  end if;

  if p_scadenza >= (p_data::timestamp at time zone 'Europe/Rome') then
    raise exception 'La scadenza deve precedere la data della tappa'
      using errcode = 'check_violation', hint = 'scadenza_dopo_tappa';
  end if;

  insert into public.tappe (nome, luogo, data_inizio, data_fine, iscrizioni_chiudono_il)
  values (p_nome, p_luogo, p_data, p_data, p_scadenza)
  returning id into v_id;

  update public.tabelloni
  set posti = case categoria when 'M' then p_posti_m else p_posti_f end
  where tappa_id = v_id;

  return v_id;
end;
$$;

revoke all on function public.crea_tappa(text, text, date, timestamptz, integer, integer) from public, anon;
grant execute on function public.crea_tappa(text, text, date, timestamptz, integer, integer) to authenticated;
