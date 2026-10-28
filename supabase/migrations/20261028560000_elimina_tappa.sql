-- Eliminazione di una tappa (admin).
--
-- L'admin può eliminare una tappa in qualunque stato, anche archiviata: la
-- tappa sparisce con tabelloni, iscrizioni, gironi, partite e punteggi (le
-- cascate delle chiavi esterne). Se era in classifica, la classifica
-- generale della sua stagione cambia: il server la ripubblica in live.
-- Il registro tecnico conserva la riga eliminata (trigger `tappe_registro`).
--
-- Una tappa archiviata resta non modificabile per tutto il resto: si
-- elimina solo da `elimina_tappa()`, con la GUC transazionale
-- `blvs.eliminazione_tappa`; un DELETE diretto viene ancora rifiutato.

create or replace function public.controlla_annulla_archivia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.stato = 'archiviata'
       and current_setting('blvs.eliminazione_tappa', true) is distinct from 'on' then
      raise exception 'Tappa archiviata: consultabile ma non modificabile'
        using errcode = 'check_violation', hint = 'tappa_archiviata';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.stato = 'archiviata' and (select auth.uid()) is not null then
      raise exception 'Una tappa si archivia solo dopo la conclusione o l''annullamento'
        using errcode = 'check_violation', hint = 'tabelloni_non_conclusi';
    end if;
    new.annullata_il := case when new.stato = 'annullata' then now() end;
    new.archiviata_il := case when new.stato = 'archiviata' then now() end;
    return new;
  end if;

  -- UPDATE
  if old.stato = 'archiviata' then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;

  if new.stato = 'archiviata' then
    if old.stato <> 'annullata' and not public.tabelloni_conclusi(old.id) then
      raise exception 'Potrai archiviare la tappa dopo la chiusura dei risultati di entrambi i tabelloni'
        using errcode = 'check_violation', hint = 'tabelloni_non_conclusi';
    end if;
    -- Archiviare non cambia nient'altro della tappa.
    new := old;
    new.stato := 'archiviata';
    new.archiviata_il := now();
    return new;
  end if;

  if old.stato = 'annullata' then
    raise exception 'Tappa annullata: si può solo archiviare'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;

  if new.stato = 'annullata' then
    if old.stato = 'conclusa' then
      raise exception 'Una tappa conclusa non si può annullare'
        using errcode = 'check_violation', hint = 'tappa_non_annullabile';
    end if;
    if char_length(btrim(coalesce(new.motivo_annullamento, ''))) = 0 then
      raise exception 'Indica il motivo dell''annullamento'
        using errcode = 'check_violation', hint = 'motivo_mancante';
    end if;
    new.motivo_annullamento := btrim(new.motivo_annullamento);
    new.annullata_il := now();
    return new;
  end if;

  -- Fuori da annullamento e archiviazione queste colonne non cambiano.
  new.motivo_annullamento := old.motivo_annullamento;
  new.annullata_il := old.annullata_il;
  new.archiviata_il := old.archiviata_il;
  return new;
end;
$$;

-- Elimina la tappa e tutto ciò che le appartiene. Security invoker: RLS
-- (`tappe_admin`) e trigger valgono come per l'admin.
-- Errori: 42501 se non admin; P0002 `tappa_non_trovata`.
-- Ritorna `{nome, stagione, in_classifica}`: con `in_classifica` il server
-- ripubblica la classifica generale di quella stagione.
create function public.elimina_tappa(p_tappa uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tappa public.tappe;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può eliminare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_tappa from public.tappe where id = p_tappa for update;
  if not found then
    raise exception 'Tappa non trovata'
      using errcode = 'no_data_found', hint = 'tappa_non_trovata';
  end if;

  perform set_config('blvs.eliminazione_tappa', 'on', true);
  delete from public.tappe where id = p_tappa;
  perform set_config('blvs.eliminazione_tappa', 'off', true);

  return jsonb_build_object(
    'nome', v_tappa.nome,
    'stagione', v_tappa.stagione,
    'in_classifica', public.tappa_in_classifica(v_tappa.stato)
  );
end;
$$;

revoke all on function public.elimina_tappa(uuid) from public, anon;
grant execute on function public.elimina_tappa(uuid) to authenticated;
