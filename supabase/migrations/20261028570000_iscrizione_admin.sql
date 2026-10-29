-- Anche un admin si iscrive a una tappa.
--
-- - Dalla pagina della tappa («Prendi il posto», `iscriviti_tappa()`)
--   l'admin è un giocatore come gli altri: valgono stato della tappa,
--   scadenza, posti, una sola iscrizione ed email confermata. Prima i
--   trigger saltavano ogni controllo per l'admin, quindi un admin poteva
--   prendersi un posto oltre il massimo o dopo la scadenza.
--   `iscriviti_tappa()` lo segnala ai trigger con la GUC transazionale
--   `blvs.iscrizione_propria`. Una bozza non accetta iscrizioni da lì,
--   nemmeno dall'admin (prima superava il controllo e finiva in «chiuse»).
-- - Gli altri inserimenti dell'admin (aggiunta dalla gestione iscritti,
--   seed, script) restano come prima.
-- - `admin_iscrivi_giocatore()` accetta anche gli admin: un admin che gioca
--   si aggiunge dalla gestione iscritti come ogni altro iscritto.

-- ---------------------------------------------------------------------------
-- Controlli dei trigger
-- ---------------------------------------------------------------------------

-- Come in BLVS-24; i controlli valgono anche per l'admin che si iscrive da sé.
create or replace function public.verifica_posti_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tappa public.tappe;
  v_posti integer;
  v_occupati integer;
  v_controlla boolean := (select auth.uid()) is not null
    and (
      not public.is_admin()
      or current_setting('blvs.iscrizione_propria', true) = 'on'
    );
begin
  select * into v_tappa from public.tappe where id = new.tappa_id;

  if v_controlla then
    if v_tappa.stato = 'annullata' then
      raise exception 'La tappa è stata annullata.'
        using errcode = 'check_violation', hint = 'annullata';
    end if;
    if v_tappa.stato <> 'iscrizioni_aperte'
      or (v_tappa.iscrizioni_aprono_il is not null
        and v_tappa.iscrizioni_aprono_il > now()) then
      raise exception 'Le iscrizioni a questa tappa sono chiuse.'
        using errcode = 'check_violation', hint = 'chiuse';
    end if;
    if v_tappa.iscrizioni_chiudono_il is not null
      and v_tappa.iscrizioni_chiudono_il <= now() then
      raise exception 'Le iscrizioni a questa tappa sono scadute.'
        using errcode = 'check_violation', hint = 'scadute';
    end if;
    if exists (
      select 1 from public.iscrizioni
      where utente_id = new.utente_id and tappa_id = new.tappa_id
    ) then
      raise exception 'Sei già iscritto a questa tappa.'
        using errcode = 'unique_violation', hint = 'gia_iscritto';
    end if;
  end if;

  select posti into v_posti
  from public.tabelloni
  where id = new.tabellone_id
  for update;

  if new.stato not in ('in_attesa', 'confermata') then
    return new;
  end if;

  select count(*)::integer into v_occupati
  from public.iscrizioni
  where tabellone_id = new.tabellone_id
    and stato in ('in_attesa', 'confermata');

  if v_controlla and v_occupati >= v_posti then
    raise exception 'Posti esauriti in questo tabellone.'
      using errcode = 'check_violation', hint = 'posti_esauriti';
  end if;

  -- Il primo numero libero da 1 al massimo; oltre il massimo (solo admin e
  -- backend) si continua dal più alto.
  if new.posto is null then
    select coalesce(
      (
        select min(n)::integer
        from generate_series(1, v_posti) as n
        where not exists (
          select 1 from public.iscrizioni i
          where i.tabellone_id = new.tabellone_id
            and i.stato in ('in_attesa', 'confermata')
            and i.posto = n
        )
      ),
      (
        select coalesce(max(i.posto), 0) + 1
        from public.iscrizioni i
        where i.tabellone_id = new.tabellone_id
          and i.stato in ('in_attesa', 'confermata')
      )
    ) into new.posto;
  end if;

  return new;
end;
$$;

-- Come in BLVS-15; l'email confermata vale anche per l'admin che si iscrive
-- da sé.
create or replace function public.verifica_email_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or (
      public.is_admin()
      and current_setting('blvs.iscrizione_propria', true) is distinct from 'on'
    ) then
    return new;
  end if;
  if not public.email_confermata(new.utente_id) then
    raise exception 'Conferma la tua email prima di iscriverti a una tappa'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Iscrizione dalla pagina della tappa
-- ---------------------------------------------------------------------------

-- Come in BLVS-51, più: bozza non trovata per tutti e GUC per i trigger.
create or replace function public.iscriviti_tappa(p_tappa uuid)
returns public.iscrizioni
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_categoria public.categoria;
  v_tabellone uuid;
  v_iscrizione public.iscrizioni;
begin
  if v_utente is null then
    raise exception 'Accedi per iscriverti.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.tappe where id = p_tappa and stato <> 'bozza'
  ) then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;

  select categoria into v_categoria from public.utenti where id = v_utente;
  if v_categoria is null then
    raise exception 'Imposta la tua categoria nel profilo prima di iscriverti.'
      using errcode = 'check_violation', hint = 'categoria_mancante';
  end if;

  select id into v_tabellone
  from public.tabelloni
  where tappa_id = p_tappa and categoria = v_categoria;

  perform public.elimina_iscrizione_annullata(p_tappa);

  perform set_config('blvs.iscrizione_propria', 'on', true);
  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
  values (p_tappa, v_tabellone, v_utente)
  returning * into v_iscrizione;
  perform set_config('blvs.iscrizione_propria', 'off', true);

  return v_iscrizione;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aggiunta dalla gestione iscritti
-- ---------------------------------------------------------------------------

-- Come in BLVS-25, ma iscrive qualunque utente registrato, admin compresi.
-- Un account cancellato non ha più il profilo: «Giocatore non trovato».
create or replace function public.admin_iscrivi_giocatore(p_tappa uuid, p_utente uuid)
returns public.iscrizioni
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
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

  select categoria into v_categoria
  from public.utenti where id = p_utente;
  if not found then
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
