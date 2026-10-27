-- BLVS-16 · Profilo: la categoria si blocca dopo la prima tappa giocata.
--
-- «Tappa giocata» = un'iscrizione non rifiutata né ritirata a una tappa
-- in corso o conclusa. Prima di allora la categoria si cambia solo senza
-- iscrizioni attive: il tabellone di un'iscrizione è quello della categoria
-- (trigger `iscrizioni_categoria`) e non deve smettere di corrispondere.
-- L'admin può sempre correggerla; il backend senza JWT pure.

-- 'bloccata' | 'iscrizione_attiva' | 'modificabile'
create function public.stato_categoria(p_utente uuid default auth.uid())
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
      and t.stato in ('in_corso', 'conclusa')
  ) then
    return 'bloccata';
  end if;

  if exists (
    select 1
    from public.iscrizioni i
    join public.tappe t on t.id = i.tappa_id
    where i.utente_id = p_utente
      and i.stato in ('in_attesa', 'confermata')
      and t.stato <> 'annullata'
  ) then
    return 'iscrizione_attiva';
  end if;

  return 'modificabile';
end;
$$;

revoke all on function public.stato_categoria(uuid) from public, anon;
grant execute on function public.stato_categoria(uuid) to authenticated, service_role;

create function public.blocca_cambio_categoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  stato text;
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;

  stato := public.stato_categoria(old.id);

  if stato = 'bloccata' then
    raise exception 'La categoria non si può più cambiare dopo la prima tappa giocata'
      using errcode = 'check_violation', hint = 'categoria_bloccata';
  end if;

  if stato = 'iscrizione_attiva' then
    raise exception 'La categoria non si può cambiare con un''iscrizione attiva'
      using errcode = 'check_violation', hint = 'iscrizione_attiva';
  end if;

  return new;
end;
$$;

create trigger utenti_blocca_categoria
before update of categoria on public.utenti
for each row
when (old.categoria is distinct from new.categoria)
execute function public.blocca_cambio_categoria();
