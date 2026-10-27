-- BLVS-33 · Coda dei punteggi offline e sessione admin chiusa (R-53, R-77).
--
-- Il punteggio inserito dall'admin finisce prima in una coda sul dispositivo
-- (IndexedDB) e parte da solo quando torna la rete o dopo il nuovo accesso.
-- Ogni punteggio in coda porta una chiave (uuid generato una volta sul
-- dispositivo): il server la ricorda, quindi un invio ripetuto (risposta
-- persa, due schede, ripresa dopo il login) non salva due volte.

create table public.punteggi_invii (
  chiave uuid primary key,
  partita_id uuid not null references public.partite (id) on delete cascade,
  -- Versione del punteggio dopo il salvataggio fatto con questa chiave.
  versione integer not null check (versione >= 1),
  autore_id uuid references public.utenti (id) on delete set null,
  created_at timestamptz not null default now()
);

create index punteggi_invii_partita on public.punteggi_invii (partita_id);

alter table public.punteggi_invii enable row level security;

-- Le scrive solo salva_punteggio_coda() (security invoker, quindi serve la
-- policy di insert per l'admin); nessuno le modifica o le cancella.
create policy punteggi_invii_select on public.punteggi_invii
for select to authenticated
using ((select public.is_admin()));
create policy punteggi_invii_insert on public.punteggi_invii
for insert to authenticated
with check ((select public.is_admin()));

grant select, insert on public.punteggi_invii to authenticated;

-- Salva i set di una partita una sola volta per chiave.
-- - chiave già vista per la stessa partita: non scrive nulla e restituisce
--   il punteggio attuale con `duplicato = true`;
-- - versione diversa da quella letta: 40001, hint `punteggio_cambiato`,
--   detail = versione attuale (il punteggio resta in coda come conflitto);
-- - altrimenti aggiorna `punteggi` (il trigger di BLVS-07 scrive il registro)
--   e ricorda la chiave.
-- Restituisce jsonb {punteggio: {partita_id, sets, versione, aggiornato_da,
-- updated_at}, duplicato}.
create function public.salva_punteggio_coda(
  p_partita uuid,
  p_versione integer,
  p_sets jsonb,
  p_chiave uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_punteggio public.punteggi%rowtype;
  v_invio public.punteggi_invii%rowtype;
  v_duplicato boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può salvare i punteggi'
      using errcode = 'insufficient_privilege';
  end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'Set del punteggio non validi'
      using errcode = 'check_violation', hint = 'sets_non_validi';
  end if;

  -- Il lock sulla riga mette in fila gli invii della stessa partita: due
  -- invii con la stessa chiave non passano mai entrambi il controllo.
  select * into v_punteggio
  from public.punteggi
  where partita_id = p_partita
  for update;
  if not found then
    raise exception 'Partita non trovata'
      using errcode = 'no_data_found';
  end if;

  select * into v_invio from public.punteggi_invii where chiave = p_chiave;
  if found then
    if v_invio.partita_id <> p_partita then
      raise exception 'Chiave di invio già usata per un''altra partita'
        using errcode = 'check_violation', hint = 'chiave_estranea';
    end if;
    v_duplicato := true;
  elsif v_punteggio.versione <> p_versione then
    raise exception 'Il punteggio è stato modificato da qualcun altro'
      using errcode = 'serialization_failure',
            hint = 'punteggio_cambiato',
            detail = v_punteggio.versione::text;
  else
    update public.punteggi
    set sets = p_sets,
        versione = v_punteggio.versione + 1,
        aggiornato_da = auth.uid()
    where partita_id = p_partita
    returning * into v_punteggio;

    insert into public.punteggi_invii (chiave, partita_id, versione, autore_id)
    values (p_chiave, p_partita, v_punteggio.versione, auth.uid());
  end if;

  return jsonb_build_object(
    'punteggio', jsonb_build_object(
      'partita_id', v_punteggio.partita_id,
      'sets', v_punteggio.sets,
      'versione', v_punteggio.versione,
      'aggiornato_da', v_punteggio.aggiornato_da,
      'updated_at', v_punteggio.updated_at
    ),
    'duplicato', v_duplicato
  );
end;
$$;

revoke all on function public.salva_punteggio_coda(uuid, integer, jsonb, uuid)
  from public, anon;
grant execute on function public.salva_punteggio_coda(uuid, integer, jsonb, uuid)
  to authenticated;
