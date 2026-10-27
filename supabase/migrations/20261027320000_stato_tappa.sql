-- BLVS-20 · Stato delle iscrizioni: bozza › aperte › chiuse.
--
-- Una sessione (admin compreso) cambia lo stato solo in avanti di un passo
-- dentro il flusso delle iscrizioni: bozza → iscrizioni_aperte →
-- iscrizioni_chiuse. Le iscrizioni si aprono solo con una scadenza futura.
-- Alla scadenza le chiude `chiudi_iscrizioni_scadute()`, chiamata dal cron
-- di Vercel (/api/cron/chiudi-iscrizioni) e prima di ogni lettura admin.
-- I passaggi verso in_corso, conclusa e annullata non sono di questo flusso
-- e restano liberi per l'admin. Il backend senza JWT (seed, script) passa.

alter table public.tappe
  add column iscrizioni_chiuse_il timestamptz,
  add column chiusura_automatica boolean not null default false;

create function public.controlla_stato_tappa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  flusso constant public.stato_tappa[] :=
    array['bozza', 'iscrizioni_aperte', 'iscrizioni_chiuse']::public.stato_tappa[];
  automatica boolean :=
    coalesce(current_setting('blvs.chiusura_automatica', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and new.stato is distinct from old.stato then
    if (select auth.uid()) is not null
       and old.stato = any (flusso)
       and new.stato = any (flusso)
       and not (
         (old.stato = 'bozza' and new.stato = 'iscrizioni_aperte')
         or (old.stato = 'iscrizioni_aperte' and new.stato = 'iscrizioni_chiuse')
       ) then
      raise exception 'Passaggio di stato non permesso: % → %', old.stato, new.stato
        using errcode = 'check_violation', hint = 'transizione_non_permessa';
    end if;

    if new.stato = 'iscrizioni_chiuse' then
      new.iscrizioni_chiuse_il := now();
      new.chiusura_automatica := automatica;
    elsif old.stato = 'iscrizioni_chiuse' then
      new.iscrizioni_chiuse_il := null;
      new.chiusura_automatica := false;
    end if;
  elsif tg_op = 'UPDATE' then
    -- Solo il passaggio di stato scrive questi due campi.
    new.iscrizioni_chiuse_il := old.iscrizioni_chiuse_il;
    new.chiusura_automatica := old.chiusura_automatica;
  else
    new.iscrizioni_chiuse_il :=
      case when new.stato = 'iscrizioni_chiuse' then now() end;
    new.chiusura_automatica := false;
  end if;

  if (select auth.uid()) is not null
     and new.stato = 'iscrizioni_aperte'
     and (
       tg_op = 'INSERT'
       or new.stato is distinct from old.stato
       or new.iscrizioni_chiudono_il is distinct from old.iscrizioni_chiudono_il
     )
     and (new.iscrizioni_chiudono_il is null or new.iscrizioni_chiudono_il <= now()) then
    raise exception 'Le iscrizioni si aprono solo con una scadenza futura'
      using errcode = 'check_violation', hint = 'scadenza_mancante';
  end if;

  return new;
end;
$$;

create trigger tappe_controlla_stato
before insert or update on public.tappe
for each row execute function public.controlla_stato_tappa();

-- Chiude le iscrizioni scadute; restituisce quante tappe ha chiuso.
-- Idempotente: chiunque la chiami chiude solo ciò che è già scaduto.
create function public.chiudi_iscrizioni_scadute()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  chiuse integer;
begin
  perform set_config('blvs.chiusura_automatica', 'on', true);
  update public.tappe
  set stato = 'iscrizioni_chiuse'
  where stato = 'iscrizioni_aperte'
    and iscrizioni_chiudono_il is not null
    and iscrizioni_chiudono_il <= now();
  get diagnostics chiuse = row_count;
  perform set_config('blvs.chiusura_automatica', '', true);
  return chiuse;
end;
$$;

revoke all on function public.chiudi_iscrizioni_scadute() from public, anon;
grant execute on function public.chiudi_iscrizioni_scadute()
  to authenticated, service_role;

-- Rete di sicurezza: tra la scadenza e il passaggio del job nessuno si iscrive.
drop policy iscrizioni_insert_giocatore on public.iscrizioni;

create policy iscrizioni_insert_giocatore on public.iscrizioni
for insert to authenticated
with check (
  utente_id = (select auth.uid())
  and stato = 'in_attesa'
  and (select public.email_confermata())
  and exists (
    select 1 from public.tappe t
    where t.id = tappa_id
      and t.stato = 'iscrizioni_aperte'
      and (t.iscrizioni_chiudono_il is null or t.iscrizioni_chiudono_il > now())
  )
);
