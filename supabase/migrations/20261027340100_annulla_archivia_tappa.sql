-- BLVS-22 · Annullamento e archiviazione di una tappa (R-12).
--
-- Annullare: sempre con un motivo, da qualunque stato prima della
-- conclusione. Una tappa annullata non accetta più iscrizioni (nemmeno
-- dall'admin) e non cambia più, salvo essere archiviata.
-- Archiviare: una tappa annullata, oppure una tappa con entrambi i tabelloni
-- conclusi (`tabelloni_conclusi()`, che BLVS-43 rende vero). Una tappa
-- archiviata resta leggibile ma nessuno può più modificarla, né lei né i
-- suoi tabelloni, iscrizioni, gironi, partite e punteggi.
-- Le regole valgono per tutti, admin e backend compresi: sono il server.

-- ---------------------------------------------------------------------------
-- Colonne
-- ---------------------------------------------------------------------------

alter table public.tappe
  add column motivo_annullamento text
    constraint tappe_motivo_annullamento_lunghezza
      check (char_length(btrim(motivo_annullamento)) between 1 and 500),
  add column annullata_il timestamptz,
  add column archiviata_il timestamptz;

comment on column public.tappe.motivo_annullamento is
  'Perché la tappa è stata annullata; obbligatorio per annullarla.';
comment on column public.tappe.annullata_il is
  'Quando è stata annullata. Scritta solo dal trigger tappe_annulla_archivia.';
comment on column public.tappe.archiviata_il is
  'Quando è stata archiviata. Scritta solo dal trigger tappe_annulla_archivia.';

-- Le tappe già annullate prima di questa migrazione non hanno un motivo.
update public.tappe
set motivo_annullamento = 'Motivo non indicato'
where stato = 'annullata' and motivo_annullamento is null;

alter table public.tappe
  add constraint tappe_annullata_con_motivo
    check (stato <> 'annullata' or motivo_annullamento is not null);

-- Momento della chiusura di un tabellone. Il dialog «Concludi tabellone» di
-- BLVS-43 la imposta; finché è null il tabellone non è concluso.
alter table public.tabelloni
  add column if not exists concluso_il timestamptz;

comment on column public.tabelloni.concluso_il is
  'Quando il tabellone è stato concluso (BLVS-43); null finché è aperto.';

-- ---------------------------------------------------------------------------
-- Regola unica: entrambi i tabelloni della tappa sono conclusi
-- ---------------------------------------------------------------------------

-- Unico punto in cui si decide se i tabelloni sono conclusi: se BLVS-43
-- sceglie un altro modello (per esempio una fase «conclusa») ridefinisce
-- solo questa funzione.
create function public.tabelloni_conclusi(p_tappa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tabelloni where tappa_id = p_tappa
  )
  and not exists (
    select 1 from public.tabelloni
    where tappa_id = p_tappa and concluso_il is null
  );
$$;

revoke all on function public.tabelloni_conclusi(uuid) from public, anon;
grant execute on function public.tabelloni_conclusi(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tappa: annullamento, archiviazione e blocco delle tappe archiviate
-- ---------------------------------------------------------------------------

create function public.controlla_annulla_archivia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.stato = 'archiviata' then
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

-- Il nome viene prima di tappe_controlla_stato e tappe_updated_at: i trigger
-- BEFORE partono in ordine alfabetico, così `updated_at` resta aggiornato.
create trigger tappe_annulla_archivia
before insert or update or delete on public.tappe
for each row execute function public.controlla_annulla_archivia();

-- ---------------------------------------------------------------------------
-- Dati della tappa: niente iscrizioni nuove se annullata, niente modifiche
-- se archiviata
-- ---------------------------------------------------------------------------

-- La tappa a cui appartiene una riga di una tabella figlia.
create function public.tappa_della_riga(p_tabella text, p_riga jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tappa uuid;
begin
  case p_tabella
    when 'iscrizioni', 'tabelloni' then
      v_tappa := (p_riga ->> 'tappa_id')::uuid;
    when 'gironi', 'partite' then
      select tb.tappa_id into v_tappa
      from public.tabelloni tb
      where tb.id = (p_riga ->> 'tabellone_id')::uuid;
    when 'girone_iscrizioni' then
      select tb.tappa_id into v_tappa
      from public.gironi g
      join public.tabelloni tb on tb.id = g.tabellone_id
      where g.id = (p_riga ->> 'girone_id')::uuid;
    when 'punteggi', 'partita_giocatori' then
      select tb.tappa_id into v_tappa
      from public.partite p
      join public.tabelloni tb on tb.id = p.tabellone_id
      where p.id = (p_riga ->> 'partita_id')::uuid;
    else
      v_tappa := null;
  end case;
  return v_tappa;
end;
$$;

revoke all on function public.tappa_della_riga(text, jsonb) from public, anon, authenticated;

create function public.blocca_dati_tappa_chiusa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_righe jsonb[] := array[]::jsonb[];
  v_riga jsonb;
  v_stato public.stato_tappa;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    v_righe := v_righe || to_jsonb(new);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_righe := v_righe || to_jsonb(old);
  end if;

  foreach v_riga in array v_righe loop
    select t.stato into v_stato
    from public.tappe t
    where t.id = public.tappa_della_riga(tg_table_name, v_riga);

    if v_stato = 'archiviata' then
      raise exception 'Tappa archiviata: consultabile ma non modificabile'
        using errcode = 'check_violation', hint = 'tappa_archiviata';
    end if;
    if tg_table_name = 'iscrizioni' and tg_op = 'INSERT'
       and v_stato = 'annullata' then
      raise exception 'La tappa è annullata: non accetta nuove iscrizioni'
        using errcode = 'check_violation', hint = 'tappa_annullata';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Prima di iscrizioni_email_confermata (ordine alfabetico): chi prova a
-- iscriversi a una tappa annullata legge questo motivo.
create trigger iscrizioni_blocca_tappa_chiusa
before insert or update or delete on public.iscrizioni
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger tabelloni_blocca_tappa_archiviata
before update on public.tabelloni
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger gironi_blocca_tappa_archiviata
before insert or update or delete on public.gironi
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger girone_iscrizioni_blocca_tappa_archiviata
before insert or update or delete on public.girone_iscrizioni
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger partite_blocca_tappa_archiviata
before insert or update or delete on public.partite
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger partita_giocatori_blocca_tappa_archiviata
before insert or update or delete on public.partita_giocatori
for each row execute function public.blocca_dati_tappa_chiusa();

create trigger punteggi_blocca_tappa_archiviata
before insert or update or delete on public.punteggi
for each row execute function public.blocca_dati_tappa_chiusa();

-- ---------------------------------------------------------------------------
-- RPC: annullare una tappa e sapere a chi mandare l'avviso
-- ---------------------------------------------------------------------------

-- Annulla la tappa e restituisce gli iscritti da avvisare (in attesa o
-- confermati). Security invoker: RLS e trigger valgono come per l'admin.
create function public.annulla_tappa(p_tappa uuid, p_motivo text)
returns table (email text, nome text, cognome text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può annullare una tappa'
      using errcode = 'insufficient_privilege';
  end if;

  update public.tappe
  set stato = 'annullata', motivo_annullamento = p_motivo
  where id = p_tappa;
  if not found then
    raise exception 'Tappa non trovata'
      using errcode = 'no_data_found', hint = 'tappa_non_trovata';
  end if;

  return query
  select u.email::text, u.nome, u.cognome
  from public.iscrizioni i
  join public.utenti u on u.id = i.utente_id
  where i.tappa_id = p_tappa
    and i.stato in ('in_attesa', 'confermata')
  order by u.email;
end;
$$;

revoke all on function public.annulla_tappa(uuid, text) from public, anon;
grant execute on function public.annulla_tappa(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Riepilogo admin (BLVS-17): motivo dell'annullamento e tabelloni conclusi
-- ---------------------------------------------------------------------------

drop function public.admin_riepilogo_tappe();

create function public.admin_riepilogo_tappe()
returns table (
  id uuid,
  nome text,
  data_inizio date,
  data_fine date,
  stato public.stato_tappa,
  motivo_annullamento text,
  categorie jsonb,
  partite_da_inserire integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Riepilogo riservato agli admin'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    t.id,
    t.nome,
    t.data_inizio,
    t.data_fine,
    t.stato,
    t.motivo_annullamento,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'categoria', tb.categoria,
            'posti', tb.posti,
            'fase', tb.fase,
            'concluso', tb.concluso_il is not null,
            'iscritti', (
              select count(*)
              from public.iscrizioni i
              where i.tabellone_id = tb.id
                and i.stato in ('in_attesa', 'confermata')
            )
          )
          order by tb.categoria
        )
        from public.tabelloni tb
        where tb.tappa_id = t.id
      ),
      '[]'::jsonb
    ),
    (
      select count(*)::integer
      from public.partite p
      join public.tabelloni tb on tb.id = p.tabellone_id
      left join public.punteggi pt on pt.partita_id = p.id
      where tb.tappa_id = t.id
        and (
          p.stato = 'in_corso'
          or (
            p.stato = 'programmata'
            and p.programmata_il <= now()
            and coalesce(jsonb_array_length(pt.sets), 0) = 0
          )
        )
    )
  from public.tappe t
  order by t.data_inizio, t.nome;
end;
$$;

revoke execute on function public.admin_riepilogo_tappe() from public, anon;
grant execute on function public.admin_riepilogo_tappe() to authenticated;

-- ---------------------------------------------------------------------------
-- Profilo (BLVS-16): una tappa archiviata conta come quella da cui viene
-- ---------------------------------------------------------------------------

-- Una tappa archiviata dopo la conclusione blocca la categoria come una
-- conclusa; una archiviata dopo l'annullamento non conta, come un'annullata.
create or replace function public.stato_categoria(p_utente uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_utente is distinct from (select auth.uid())
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Puoi leggere solo lo stato della tua categoria'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = p_utente
      and i.stato not in ('rifiutata', 'ritirata')
      and (
        t.stato in ('in_corso', 'conclusa')
        or (t.stato = 'archiviata' and t.annullata_il is null)
      )
  ) then
    return 'bloccata';
  end if;

  if exists (
    select 1
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = p_utente
      and i.stato in ('in_attesa', 'confermata')
      and t.stato not in ('annullata', 'archiviata')
  ) then
    return 'iscrizione_attiva';
  end if;

  return 'modificabile';
end;
$$;
