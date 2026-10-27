-- BLVS-34 · Conflitto tra admin (R-57).
-- `salva_punteggio` (BLVS-32) already refuses a stale version (40001
-- `versione_superata`). This adds what the conflict dialog needs:
--   * punteggio_attuale(): the official score with who saved it and when;
--   * sovrascrivi_punteggio(): «Sovrascrivi», only over the version the
--     admin saw in the dialog, written in the registro with a note.

-- ---------------------------------------------------------------------------
-- Nota di contesto per il registro
-- ---------------------------------------------------------------------------

-- A typed event written without a note takes the transaction-local
-- setting `blvs.nota_registro`, if set. Lets a wrapper RPC annotate the
-- event written by another function without redefining it.
create function public.registro_nota_contesto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.tipo is not null and new.nota is null then
    new.nota := nullif(current_setting('blvs.nota_registro', true), '');
  end if;
  return new;
end;
$$;

create trigger registro_nota_contesto
before insert on public.registro
for each row execute function public.registro_nota_contesto();

-- ---------------------------------------------------------------------------
-- Punteggio ufficiale
-- ---------------------------------------------------------------------------

create function public.punteggio_attuale(p_partita uuid)
returns table (
  versione integer,
  sets jsonb,
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
    raise exception 'Solo l''amministrazione può leggere i punteggi'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    pt.versione,
    pt.sets,
    nullif(trim(concat_ws(' ', u.nome, u.cognome)), ''),
    pt.updated_at
  from public.punteggi pt
  left join public.utenti u on u.id = pt.aggiornato_da
  where pt.partita_id = p_partita;

  if not found then
    raise exception 'Partita non trovata.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.punteggio_attuale(uuid) from public, anon;
grant execute on function public.punteggio_attuale(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Sovrascrittura dopo conflitto
-- ---------------------------------------------------------------------------

-- `p_versione_vista` is the version shown in the conflict dialog: if
-- another save landed since, `salva_punteggio` refuses it again
-- (40001 `versione_superata`), so no value is ever overwritten unseen.
create function public.sovrascrivi_punteggio(
  p_partita uuid,
  p_versione_vista integer,
  p_a integer,
  p_b integer
)
returns table (versione integer, tipo public.tipo_evento_registro)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform set_config(
    'blvs.nota_registro', 'Sovrascrittura dopo conflitto', true
  );
  return query
  select s.versione, s.tipo
  from public.salva_punteggio(p_partita, p_versione_vista, p_a, p_b) s;
  perform set_config('blvs.nota_registro', '', true);
end;
$$;

revoke all on function public.sovrascrivi_punteggio(uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.sovrascrivi_punteggio(uuid, integer, integer, integer)
  to authenticated;
