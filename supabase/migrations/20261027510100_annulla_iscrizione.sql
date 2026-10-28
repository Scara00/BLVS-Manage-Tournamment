-- BLVS-51 · Le mie iscrizioni e annullamento (w-mie-iscrizioni,
-- w-annulla-iscrizione).
--
-- - `regola_annullamento()` (Q-09): fino a quando il giocatore annulla
--   quando la tappa non ha né `annullabile_fino_al` né la scadenza delle
--   iscrizioni. Specchio di `REGOLA_ANNULLAMENTO` in
--   `src/lib/iscrizioni/annullamento/regola.ts` (un test PGlite li confronta).
-- - `scadenza_annullamento(p_tappa)`: l'UNICO calcolo della scadenza.
-- - `annulla_iscrizione(p_iscrizione)`: il giocatore annulla la propria
--   iscrizione entro la scadenza (orario del server). Il posto torna libero
--   (`stato = 'ritirata'`: l'indice unico parziale e `tabelloni_tappa()`
--   contano solo le iscrizioni attive) e il registro riceve
--   `annullamento_iscrizione`.
-- - `iscriviti_tappa()` ridefinita: chi ha annullato può prendere di nuovo
--   un posto (la sua vecchia riga `ritirata` viene sostituita).

-- ---------------------------------------------------------------------------
-- Regola e scadenza
-- ---------------------------------------------------------------------------

-- `inizio_tappa`: senza scadenze si annulla fino all'inizio del primo giorno
-- della tappa (mezzanotte, Europe/Rome). `nessuno`: senza scadenze non si
-- annulla. Decisione del cliente: `inizio_tappa`.
create function public.regola_annullamento()
returns table (ripiego text)
language sql
immutable
set search_path = ''
as $$
  select 'inizio_tappa'::text;
$$;

grant execute on function public.regola_annullamento() to anon, authenticated, service_role;

-- L'ultimo istante (escluso) in cui il giocatore può annullare: la scadenza
-- per annullare, altrimenti quella delle iscrizioni, altrimenti il ripiego
-- della regola. Null = non si annulla.
create function public.scadenza_annullamento(p_tappa uuid)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(
    t.annullabile_fino_al,
    t.iscrizioni_chiudono_il,
    case
      when (select r.ripiego from public.regola_annullamento() r) = 'inizio_tappa'
        then t.data_inizio::timestamp at time zone 'Europe/Rome'
    end
  )
  from public.tappe t
  where t.id = p_tappa;
$$;

grant execute on function public.scadenza_annullamento(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Annullamento da parte del giocatore
-- ---------------------------------------------------------------------------

-- Security definer: il giocatore non ha una policy di UPDATE sulle
-- iscrizioni, e il registro lo scrivono solo le funzioni. Si annulla solo
-- la PROPRIA iscrizione: quella di un altro dà lo stesso P0002 di una che
-- non esiste. Il lock sul tabellone è lo stesso del trigger
-- `iscrizioni_posti`, così un annullamento e un'iscrizione allo stesso
-- tabellone si mettono in fila e i contatori restano giusti.
--
-- Rifiuti (23514, hint): `non_attiva` (già annullata o rifiutata),
-- `tappa_annullata`, `tappa_iniziata` (in corso, conclusa, archiviata),
-- `scadenza_superata` (detail = la scadenza, ISO), `in_girone` (i gironi
-- sono già fatti: decisione del cliente, si rifiuta).
create function public.annulla_iscrizione(p_iscrizione uuid)
returns table (
  iscrizione_id uuid,
  tappa_id uuid,
  categoria public.categoria,
  posto integer,
  posti integer,
  occupati integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := (select auth.uid());
  v_iscrizione public.iscrizioni;
  v_tappa public.tappe;
  v_categoria public.categoria;
  v_posti integer;
  v_scadenza timestamptz;
begin
  if v_utente is null then
    raise exception 'Accedi per annullare l''iscrizione.'
      using errcode = 'insufficient_privilege';
  end if;

  select i.* into v_iscrizione
  from public.iscrizioni i
  where i.id = p_iscrizione and i.utente_id = v_utente;
  if not found then
    raise exception 'Iscrizione non trovata.'
      using errcode = 'no_data_found', hint = 'iscrizione_non_trovata';
  end if;

  select tb.categoria, tb.posti into v_categoria, v_posti
  from public.tabelloni tb
  where tb.id = v_iscrizione.tabellone_id
  for update;

  -- Riletta dopo il lock: un annullamento contemporaneo è già visibile.
  select i.* into v_iscrizione
  from public.iscrizioni i
  where i.id = p_iscrizione
  for update;

  if v_iscrizione.stato not in ('in_attesa', 'confermata') then
    raise exception 'Questa iscrizione non è più attiva.'
      using errcode = 'check_violation', hint = 'non_attiva';
  end if;

  select t.* into v_tappa from public.tappe t where t.id = v_iscrizione.tappa_id;
  if v_tappa.stato = 'annullata' then
    raise exception 'La tappa è stata annullata.'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;
  if v_tappa.stato not in ('iscrizioni_aperte', 'iscrizioni_chiuse') then
    raise exception 'La tappa è iniziata: l''iscrizione non si annulla più.'
      using errcode = 'check_violation', hint = 'tappa_iniziata';
  end if;

  v_scadenza := public.scadenza_annullamento(v_tappa.id);
  if v_scadenza is null or now() >= v_scadenza then
    raise exception 'La scadenza per annullare è passata.'
      using errcode = 'check_violation', hint = 'scadenza_superata',
        detail = coalesce(to_char(v_scadenza at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '');
  end if;

  if exists (
    select 1 from public.girone_iscrizioni gi
    where gi.iscrizione_id = p_iscrizione
  ) then
    raise exception 'Sei già in un girone: scrivi all''organizzazione per ritirarti.'
      using errcode = 'check_violation', hint = 'in_girone';
  end if;

  update public.iscrizioni i
  set stato = 'ritirata'
  where i.id = p_iscrizione;

  insert into public.registro (
    attore_id, azione, entita, entita_id, tipo, valore_prima, valore_dopo, nota
  )
  values (
    v_utente,
    'evento',
    'iscrizioni',
    p_iscrizione::text,
    'annullamento_iscrizione',
    jsonb_build_object(
      'stato', v_iscrizione.stato,
      'posto', v_iscrizione.posto,
      'categoria', v_categoria,
      'tappa_id', v_tappa.id
    ),
    jsonb_build_object(
      'stato', 'ritirata',
      'posto', v_iscrizione.posto,
      'categoria', v_categoria,
      'tappa_id', v_tappa.id,
      'scadenza', v_scadenza
    ),
    'Annullata dal giocatore'
  );

  return query
  select
    v_iscrizione.id,
    v_tappa.id,
    v_categoria,
    v_iscrizione.posto,
    v_posti,
    (
      select count(*)::integer
      from public.iscrizioni i
      where i.tabellone_id = v_iscrizione.tabellone_id
        and i.stato in ('in_attesa', 'confermata')
    );
end;
$$;

revoke all on function public.annulla_iscrizione(uuid) from public, anon;
grant execute on function public.annulla_iscrizione(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Di nuovo iscritto dopo un annullamento
-- ---------------------------------------------------------------------------

-- La riga `ritirata` che il giocatore stesso ha annullato (c'è il suo
-- evento `annullamento_iscrizione` nel registro). Una rimozione dell'admin
-- (BLVS-25) resta: lì si torna solo con «Aggiungi giocatore».
create function public.elimina_iscrizione_annullata(p_tappa uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.iscrizioni i
  where i.tappa_id = p_tappa
    and i.utente_id = (select auth.uid())
    and i.stato = 'ritirata'
    and exists (
      select 1 from public.registro r
      where r.tipo = 'annullamento_iscrizione'
        and r.entita = 'iscrizioni'
        and r.entita_id = i.id::text
        and r.attore_id = i.utente_id
    );
$$;

revoke all on function public.elimina_iscrizione_annullata(uuid) from public, anon;
grant execute on function public.elimina_iscrizione_annullata(uuid) to authenticated;

-- Come in BLVS-24, più la sostituzione della riga annullata dal giocatore.
-- Tutto in una transazione: se l'iscrizione nuova è rifiutata (chiuse,
-- posti esauriti…) la vecchia riga torna com'era.
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
    select 1 from public.tappe
    where id = p_tappa and (stato <> 'bozza' or public.is_admin())
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

  insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
  values (p_tappa, v_tabellone, v_utente)
  returning * into v_iscrizione;

  return v_iscrizione;
end;
$$;
