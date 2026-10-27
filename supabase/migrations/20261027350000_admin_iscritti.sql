-- BLVS-25 · Gestione degli iscritti da admin (w-admin-iscritti,
-- w-admin-aggiungi-giocatore).
--
-- - `admin_iscrivi_giocatore()`: l'admin iscrive un giocatore registrato
--   anche a iscrizioni chiuse o scadute, con lo STESSO controllo
--   transazionale del giocatore su massimo e unicità (lock sul tabellone).
--   A differenza dell'insert diretto (BLVS-24: admin e backend possono
--   andare oltre il massimo), da qui il massimo non si supera mai.
-- - `admin_rimuovi_iscrizione()`: ritira l'iscrizione; il posto torna libero
--   (l'indice unico parziale conta solo le iscrizioni attive).
--
-- Stati in cui l'elenco si modifica: bozza, iscrizioni aperte e chiuse. In
-- corso e conclusa no (gironi e partite già decisi); annullata e
-- archiviata restano in sola lettura.

create function public.tappa_iscritti_modificabili(p_stato public.stato_tappa)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_stato in ('bozza', 'iscrizioni_aperte', 'iscrizioni_chiuse');
$$;

-- ---------------------------------------------------------------------------
-- Aggiunta di un giocatore da parte dell'admin
-- ---------------------------------------------------------------------------

-- Security invoker: valgono RLS (`iscrizioni_admin`) e i trigger
-- (`iscrizioni_posti` assegna il primo posto libero, il blocco delle tappe
-- archiviate e annullate). Il tabellone è quello della categoria del
-- giocatore. Un'iscrizione non più attiva (ritirata, rifiutata) dello stesso
-- giocatore viene sostituita: il vincolo `unique (utente_id, tappa_id)`
-- altrimenti impedirebbe di iscriverlo di nuovo.
create function public.admin_iscrivi_giocatore(p_tappa uuid, p_utente uuid)
returns public.iscrizioni
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
  v_ruolo public.ruolo_utente;
  v_categoria public.categoria;
  v_tabellone uuid;
  v_posti integer;
  v_occupati integer;
  v_iscrizione public.iscrizioni;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può iscrivere un giocatore.'
      using errcode = 'insufficient_privilege';
  end if;

  select stato into v_stato from public.tappe where id = p_tappa;
  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;
  if v_stato = 'archiviata' then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_stato = 'annullata' then
    raise exception 'La tappa è annullata: non accetta nuove iscrizioni'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;
  if not public.tappa_iscritti_modificabili(v_stato) then
    raise exception 'Con la tappa in corso o conclusa gli iscritti non cambiano più.'
      using errcode = 'check_violation', hint = 'tappa_non_iscrivibile';
  end if;

  select ruolo, categoria into v_ruolo, v_categoria
  from public.utenti where id = p_utente;
  if not found or v_ruolo <> 'giocatore' then
    raise exception 'Giocatore non trovato.'
      using errcode = 'no_data_found', hint = 'giocatore_non_trovato';
  end if;
  if v_categoria is null then
    raise exception 'Il giocatore non ha ancora scelto la categoria.'
      using errcode = 'check_violation', hint = 'categoria_mancante';
  end if;

  -- Stesso lock del trigger `iscrizioni_posti`: aggiunte e iscrizioni
  -- contemporanee allo stesso tabellone si mettono in fila qui.
  select id, posti into v_tabellone, v_posti
  from public.tabelloni
  where tappa_id = p_tappa and categoria = v_categoria
  for update;

  if exists (
    select 1 from public.iscrizioni
    where utente_id = p_utente and tappa_id = p_tappa
      and stato in ('in_attesa', 'confermata')
  ) then
    raise exception 'Il giocatore è già iscritto a questa tappa.'
      using errcode = 'unique_violation', hint = 'gia_iscritto';
  end if;

  select count(*)::integer into v_occupati
  from public.iscrizioni
  where tabellone_id = v_tabellone
    and stato in ('in_attesa', 'confermata');
  if v_occupati >= v_posti then
    raise exception 'Posti esauriti in questo tabellone.'
      using errcode = 'check_violation', hint = 'posti_esauriti';
  end if;

  delete from public.iscrizioni
  where utente_id = p_utente and tappa_id = p_tappa
    and stato not in ('in_attesa', 'confermata');

  -- Aggiunta dall'admin: l'iscrizione è già confermata.
  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id, stato)
  values (p_tappa, v_tabellone, p_utente, 'confermata')
  returning * into v_iscrizione;

  return v_iscrizione;
end;
$$;

revoke all on function public.admin_iscrivi_giocatore(uuid, uuid) from public, anon;
grant execute on function public.admin_iscrivi_giocatore(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rimozione di un iscritto
-- ---------------------------------------------------------------------------

-- L'iscrizione passa a `ritirata` (resta nello storico con il suo numero di
-- posto); il posto torna libero. Esce anche dal suo girone, se ne aveva uno.
create function public.admin_rimuovi_iscrizione(p_iscrizione uuid)
returns public.iscrizioni
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_iscrizione public.iscrizioni;
  v_stato public.stato_tappa;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può rimuovere un iscritto.'
      using errcode = 'insufficient_privilege';
  end if;

  select i.* into v_iscrizione
  from public.iscrizioni i
  where i.id = p_iscrizione and i.stato in ('in_attesa', 'confermata')
  for update;
  if not found then
    raise exception 'Iscrizione non trovata.'
      using errcode = 'no_data_found', hint = 'iscrizione_non_trovata';
  end if;

  select stato into v_stato from public.tappe where id = v_iscrizione.tappa_id;
  if v_stato = 'archiviata' then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_stato = 'annullata' then
    raise exception 'La tappa è annullata: gli iscritti non cambiano più.'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;
  if not public.tappa_iscritti_modificabili(v_stato) then
    raise exception 'Con la tappa in corso o conclusa gli iscritti non cambiano più.'
      using errcode = 'check_violation', hint = 'tappa_non_iscrivibile';
  end if;

  delete from public.girone_iscrizioni where iscrizione_id = p_iscrizione;

  update public.iscrizioni
  set stato = 'ritirata'
  where id = p_iscrizione
  returning * into v_iscrizione;

  return v_iscrizione;
end;
$$;

revoke all on function public.admin_rimuovi_iscrizione(uuid) from public, anon;
grant execute on function public.admin_rimuovi_iscrizione(uuid) to authenticated;
