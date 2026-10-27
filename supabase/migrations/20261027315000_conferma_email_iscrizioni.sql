-- BLVS-15 · Conferma dell'indirizzo email prima della prima iscrizione.
--
-- La conferma la gestisce Supabase Auth (`[auth.email] enable_confirmations`
-- in config.toml): `auth.users.email_confirmed_at` è l'unica fonte di verità.
-- Qui il database rifiuta l'iscrizione a una tappa di chi non ha ancora
-- confermato, qualunque sia il client che la tenta.

-- Vero se l'utente `p_utente` (di default chi è connesso) ha confermato
-- l'email. Security definer: i client non leggono auth.users.
create function public.email_confermata(p_utente uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.email_confirmed_at is not null
      from auth.users u
      where u.id = coalesce(p_utente, (select auth.uid()))
    ),
    false
  );
$$;

revoke execute on function public.email_confermata(uuid) from public, anon;
grant execute on function public.email_confermata(uuid) to authenticated, service_role;

-- Messaggio esplicito (42501) invece del generico rifiuto RLS. Il server con
-- la chiave segreta, il seed e gli admin (auth.uid() nullo o admin) passano.
create function public.verifica_email_iscrizione()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_admin() then
    return new;
  end if;
  if not public.email_confermata(new.utente_id) then
    raise exception 'Conferma la tua email prima di iscriverti a una tappa'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger iscrizioni_email_confermata
before insert on public.iscrizioni
for each row execute function public.verifica_email_iscrizione();

-- Anche la policy lo richiede: la regola resta valida se il trigger cambia.
drop policy iscrizioni_insert_giocatore on public.iscrizioni;

create policy iscrizioni_insert_giocatore on public.iscrizioni
for insert to authenticated
with check (
  utente_id = (select auth.uid())
  and stato = 'in_attesa'
  and (select public.email_confermata())
  and exists (
    select 1 from public.tappe t
    where t.id = tappa_id and t.stato = 'iscrizioni_aperte'
  )
);
