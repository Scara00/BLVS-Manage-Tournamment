-- BLVS-28 · Editor dei gironi (w-admin-gironi, w-admin-sposta).
-- L'admin sposta e scambia giocatori, aggiunge ed elimina gironi. Ogni
-- modifica si salva subito, con una RPC per modifica:
--   sposta_in_girone, scambia_in_girone, aggiungi_girone, elimina_girone.
-- Tutte prendono la versione dei gironi letta (`tabelloni.versione_gironi`):
-- se nel frattempo è cambiata rispondono 40001 `versione_superata`.
-- Appena una partita dei gironi del tabellone è iniziata (stato diverso da
-- `programmata`) i gironi sono bloccati (23514 `gironi_non_modificabili`).
-- Le partite programmate dei gironi toccati vengono eliminate: le rigenera
-- la generazione delle partite (BLVS-26/30).
-- I controlli (4 per girone, tutti assegnati) sono avvisi nell'editor, non
-- vincoli: l'admin può tenere un girone incompleto.

alter table public.tabelloni
  add column if not exists versione_gironi integer not null default 0
    check (versione_gironi >= 0);

-- ---------------------------------------------------------------------------
-- Controlli comuni a ogni modifica
-- ---------------------------------------------------------------------------

-- Admin, tabellone bloccato in scrittura, versione attuale, nessuna partita
-- dei gironi iniziata; poi elimina le partite programmate dei gironi toccati.
create function public.gironi_prepara_modifica(
  p_tabellone uuid,
  p_versione integer,
  p_gironi uuid[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_versione integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select versione_gironi into v_versione
  from public.tabelloni
  where id = p_tabellone
  for update;
  if not found then
    raise exception 'Tabellone non trovato' using errcode = 'no_data_found';
  end if;

  if v_versione <> p_versione then
    raise exception 'I gironi sono cambiati nel frattempo'
      using errcode = 'serialization_failure',
        hint = 'versione_superata',
        detail = v_versione::text;
  end if;

  if exists (
    select 1 from public.partite p
    where p.tabellone_id = p_tabellone
      and p.girone_id is not null
      and p.stato <> 'programmata'
  ) then
    raise exception 'Le partite dei gironi sono iniziate: i gironi non si modificano più'
      using errcode = 'check_violation', hint = 'gironi_non_modificabili';
  end if;

  delete from public.partite p
  where p.girone_id = any (p_gironi);
end;
$$;

-- Bumps and returns the version of the board's groups.
create function public.gironi_nuova_versione(p_tabellone uuid)
returns integer
language sql
set search_path = ''
as $$
  update public.tabelloni
  set versione_gironi = versione_gironi + 1
  where id = p_tabellone
  returning versione_gironi;
$$;

-- The group of a registration on this board (null = not assigned).
-- Raises `iscrizione_estranea` when the registration is not a confirmed
-- one of this board.
create function public.gironi_girone_di(p_tabellone uuid, p_iscrizione uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_girone uuid;
begin
  if not exists (
    select 1 from public.iscrizioni i
    where i.id = p_iscrizione
      and i.tabellone_id = p_tabellone
      and i.stato = 'confermata'
  ) then
    raise exception 'Il giocatore non è un iscritto confermato di questo tabellone'
      using errcode = 'check_violation', hint = 'iscrizione_estranea';
  end if;

  select gi.girone_id into v_girone
  from public.girone_iscrizioni gi
  join public.gironi g on g.id = gi.girone_id
  where gi.iscrizione_id = p_iscrizione and g.tabellone_id = p_tabellone;
  return v_girone;
end;
$$;

create function public.gironi_verifica_girone(p_tabellone uuid, p_girone uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.gironi g
    where g.id = p_girone and g.tabellone_id = p_tabellone
  ) then
    raise exception 'Girone non trovato in questo tabellone'
      using errcode = 'check_violation', hint = 'girone_estraneo';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Modifiche
-- ---------------------------------------------------------------------------

-- Moves a player to `p_girone` (null = «Non assegnati»).
create function public.sposta_in_girone(
  p_tabellone uuid,
  p_versione integer,
  p_iscrizione uuid,
  p_girone uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_da uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;
  v_da := public.gironi_girone_di(p_tabellone, p_iscrizione);
  if p_girone is not null then
    perform public.gironi_verifica_girone(p_tabellone, p_girone);
  end if;

  -- Nothing moves: check the version, but leave the matches alone.
  perform public.gironi_prepara_modifica(
    p_tabellone, p_versione,
    case when v_da is not distinct from p_girone then array[]::uuid[]
      else array_remove(array[v_da, p_girone], null) end
  );

  if v_da is not distinct from p_girone then
    return p_versione;
  end if;

  delete from public.girone_iscrizioni where iscrizione_id = p_iscrizione;
  if p_girone is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (p_girone, p_iscrizione);
  end if;
  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

-- Each of the two players takes the other's place (a group or «Non
-- assegnati»).
create function public.scambia_in_girone(
  p_tabellone uuid,
  p_versione integer,
  p_a uuid,
  p_b uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_ga uuid;
  v_gb uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;
  v_ga := public.gironi_girone_di(p_tabellone, p_a);
  v_gb := public.gironi_girone_di(p_tabellone, p_b);

  perform public.gironi_prepara_modifica(
    p_tabellone, p_versione,
    case when v_ga is not distinct from v_gb then array[]::uuid[]
      else array_remove(array[v_ga, v_gb], null) end
  );

  if v_ga is not distinct from v_gb then
    return p_versione;
  end if;

  delete from public.girone_iscrizioni where iscrizione_id in (p_a, p_b);
  if v_gb is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (v_gb, p_a);
  end if;
  if v_ga is not null then
    insert into public.girone_iscrizioni (girone_id, iscrizione_id)
    values (v_ga, p_b);
  end if;
  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

-- Adds an empty group named with the first free «Girone A…Z» (then
-- «Girone 27»…), in the last position. Same rule as
-- `prossimoNomeGirone()` in src/lib/gironi/editor/operazioni.ts.
create function public.aggiungi_girone(p_tabellone uuid, p_versione integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_nome text;
  v_i integer := 0;
begin
  perform public.gironi_prepara_modifica(p_tabellone, p_versione, array[]::uuid[]);

  loop
    v_nome := case
      when v_i < 26 then 'Girone ' || chr(65 + v_i)
      else 'Girone ' || (v_i + 1)::text
    end;
    exit when not exists (
      select 1 from public.gironi g
      where g.tabellone_id = p_tabellone and g.nome = v_nome
    );
    v_i := v_i + 1;
  end loop;

  insert into public.gironi (tabellone_id, nome, posizione)
  select p_tabellone, v_nome, coalesce(max(g.posizione), 0) + 1
  from public.gironi g
  where g.tabellone_id = p_tabellone;

  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

-- Deletes a group: its players become «Non assegnati» (cascade on
-- girone_iscrizioni), its scheduled matches go with it.
create function public.elimina_girone(
  p_tabellone uuid,
  p_versione integer,
  p_girone uuid
)
returns integer
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;
  perform public.gironi_verifica_girone(p_tabellone, p_girone);
  perform public.gironi_prepara_modifica(p_tabellone, p_versione, array[p_girone]);

  delete from public.gironi where id = p_girone;
  return public.gironi_nuova_versione(p_tabellone);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lettura per l'editor
-- ---------------------------------------------------------------------------

-- Full name as the editor shows it; the email when the profile has none.
create function public.gironi_nome_giocatore(p_utente public.utenti)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p_utente.nome || ' ' || p_utente.cognome), ''),
    p_utente.email::text
  );
$$;

-- The groups of a board with their players, the confirmed players in no
-- group, the version and whether a group match has started.
create function public.gironi_editor(p_tabellone uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_tabellone public.tabelloni;
begin
  if not public.is_admin() then
    raise exception 'Solo un amministratore può modificare i gironi'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_tabellone from public.tabelloni where id = p_tabellone;
  if not found then
    raise exception 'Tabellone non trovato' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'tabellone_id', v_tabellone.id,
    'fase', v_tabellone.fase,
    'versione', v_tabellone.versione_gironi,
    'bloccata', exists (
      select 1 from public.partite p
      where p.tabellone_id = p_tabellone
        and p.girone_id is not null
        and p.stato <> 'programmata'
    ),
    'gironi', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'nome', g.nome,
          'posizione', g.posizione,
          'giocatori', coalesce((
            select jsonb_agg(
              jsonb_build_object('iscrizione_id', i.id, 'nome', public.gironi_nome_giocatore(u))
              order by u.cognome, u.nome, i.id
            )
            from public.girone_iscrizioni gi
            join public.iscrizioni i on i.id = gi.iscrizione_id
            join public.utenti u on u.id = i.utente_id
            where gi.girone_id = g.id
          ), '[]'::jsonb)
        )
        order by g.posizione, g.nome
      )
      from public.gironi g
      where g.tabellone_id = p_tabellone
    ), '[]'::jsonb),
    'non_assegnati', coalesce((
      select jsonb_agg(
        jsonb_build_object('iscrizione_id', i.id, 'nome', public.gironi_nome_giocatore(u))
        order by u.cognome, u.nome, i.id
      )
      from public.iscrizioni i
      join public.utenti u on u.id = i.utente_id
      where i.tabellone_id = p_tabellone
        and i.stato = 'confermata'
        and not exists (
          select 1 from public.girone_iscrizioni gi
          join public.gironi g on g.id = gi.girone_id
          where gi.iscrizione_id = i.id and g.tabellone_id = p_tabellone
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi: solo utenti autenticati (le funzioni verificano l'admin).
-- Le funzioni di supporto sono security invoker e le chiamano le RPC con
-- i diritti di chi le chiama: anche loro servono ad authenticated.
-- ---------------------------------------------------------------------------

revoke all on function public.gironi_prepara_modifica(uuid, integer, uuid[]) from public, anon;
revoke all on function public.gironi_nuova_versione(uuid) from public, anon;
revoke all on function public.gironi_girone_di(uuid, uuid) from public, anon;
revoke all on function public.gironi_verifica_girone(uuid, uuid) from public, anon;
revoke all on function public.gironi_nome_giocatore(public.utenti) from public, anon;

revoke all on function public.sposta_in_girone(uuid, integer, uuid, uuid) from public, anon;
revoke all on function public.scambia_in_girone(uuid, integer, uuid, uuid) from public, anon;
revoke all on function public.aggiungi_girone(uuid, integer) from public, anon;
revoke all on function public.elimina_girone(uuid, integer, uuid) from public, anon;
revoke all on function public.gironi_editor(uuid) from public, anon;

grant execute on function public.sposta_in_girone(uuid, integer, uuid, uuid) to authenticated;
grant execute on function public.scambia_in_girone(uuid, integer, uuid, uuid) to authenticated;
grant execute on function public.aggiungi_girone(uuid, integer) to authenticated;
grant execute on function public.elimina_girone(uuid, integer, uuid) to authenticated;
grant execute on function public.gironi_editor(uuid) to authenticated;
grant execute on function public.gironi_nome_giocatore(public.utenti) to authenticated;
grant execute on function public.gironi_prepara_modifica(uuid, integer, uuid[]) to authenticated;
grant execute on function public.gironi_nuova_versione(uuid) to authenticated;
grant execute on function public.gironi_girone_di(uuid, uuid) to authenticated;
grant execute on function public.gironi_verifica_girone(uuid, uuid) to authenticated;
