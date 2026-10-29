-- Audit di sicurezza (29/10/2026): dati personali nel registro e campi che
-- un giocatore poteva scegliere scrivendo direttamente con l'API.
--
-- - Registro: il trigger tecnico su `utenti` copiava la riga intera (email,
--   nome, cognome) prima e dopo ogni cambio di ruolo, categoria o email, e il
--   registro non si cancella: quei dati restavano anche dopo la
--   cancellazione dell'account. Ora registra solo ruolo, categoria e se
--   l'email è cambiata; le righe già scritte vengono ripulite allo stesso
--   modo.
-- - Iscrizioni: chi si iscrive da sé (giocatore, o admin dalla pagina della
--   tappa) non sceglie più posto (che decide la lettera nel girone), date di
--   creazione e modifica.
-- - Consensi e profilo: un giocatore non retrodata più i propri consensi né
--   la data di creazione del proprio profilo.
-- Il backend senza JWT (seed, script, dashboard) resta libero, come altrove.

-- ---------------------------------------------------------------------------
-- Registro di `utenti` senza dati personali
-- ---------------------------------------------------------------------------

create function public.scrivi_registro_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registro (attore_id, azione, entita, entita_id, dati)
  values (
    (select auth.uid()),
    'update',
    'utenti',
    new.id::text,
    jsonb_build_object(
      'prima', jsonb_build_object('ruolo', old.ruolo, 'categoria', old.categoria),
      'dopo', jsonb_build_object('ruolo', new.ruolo, 'categoria', new.categoria),
      'email_cambiata', old.email is distinct from new.email
    )
  );
  return null;
end;
$$;

revoke all on function public.scrivi_registro_utente() from public, anon, authenticated;

drop trigger if exists utenti_registro on public.utenti;
create trigger utenti_registro
after update of ruolo, categoria, email on public.utenti
for each row execute function public.scrivi_registro_utente();

-- Le righe già scritte: restano ruolo e categoria, via email e nomi. Il
-- registro è in sola aggiunta per l'API; qui la pulizia passa una volta.
alter table public.registro disable trigger registro_append_only;

update public.registro r
set dati = jsonb_build_object(
  'prima', jsonb_build_object(
    'ruolo', r.dati -> 'prima' -> 'ruolo',
    'categoria', r.dati -> 'prima' -> 'categoria'
  ),
  'dopo', jsonb_build_object(
    'ruolo', r.dati -> 'dopo' -> 'ruolo',
    'categoria', r.dati -> 'dopo' -> 'categoria'
  ),
  'email_cambiata',
    (r.dati -> 'prima' ->> 'email') is distinct from (r.dati -> 'dopo' ->> 'email')
)
where r.entita = 'utenti'
  and r.azione = 'update'
  and r.dati ? 'prima';

alter table public.registro enable trigger registro_append_only;

-- ---------------------------------------------------------------------------
-- Iscrizione da sé: posto e date li decide il database
-- ---------------------------------------------------------------------------

-- Prima di `iscrizioni_posti` (ordine alfabetico), che assegna il primo
-- posto libero quando `posto` è vuoto. Stessa condizione dei controlli del
-- giocatore in `verifica_posti_iscrizione()`.
create function public.campi_di_sistema_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (
       not public.is_admin()
       or current_setting('blvs.iscrizione_propria', true) = 'on'
     ) then
    new.posto := null;
    new.created_at := now();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.campi_di_sistema_iscrizione() from public, anon, authenticated;

create trigger iscrizioni_campi_di_sistema
before insert on public.iscrizioni
for each row execute function public.campi_di_sistema_iscrizione();

-- ---------------------------------------------------------------------------
-- Consensi e profilo: date non scelte dal giocatore
-- ---------------------------------------------------------------------------

create function public.data_consenso_attuale()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

revoke all on function public.data_consenso_attuale() from public, anon, authenticated;

create trigger consensi_data_attuale
before insert on public.consensi
for each row execute function public.data_consenso_attuale();

create function public.mantieni_creazione_utente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

revoke all on function public.mantieni_creazione_utente() from public, anon, authenticated;

create trigger utenti_creazione_fissa
before update on public.utenti
for each row execute function public.mantieni_creazione_utente();
