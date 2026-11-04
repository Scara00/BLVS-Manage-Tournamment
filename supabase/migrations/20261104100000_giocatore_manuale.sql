-- Giocatori aggiunti a mano dall'admin, senza un account proprio
-- (w-admin-aggiungi-manuale): servono per riempire una tappa e provarla senza
-- registrare un'email per ogni giocatore.
--
-- Gironi, partite, punteggi e classifiche leggono tutti `utenti`, e `utenti.id`
-- dipende da `auth.users`. Un giocatore aggiunto a mano è quindi una riga di
-- `auth.users` come le altre (il profilo lo crea `on_auth_user_created`), ma
-- senza password né identità: nessuno può accedere con quell'account.
--
-- - L'email è generata sul dominio riservato `manuale.blvs.invalid` (RFC 2606):
--   non arriva mai a nessuno e distingue questi account dagli altri.
--   TS: `DOMINIO_EMAIL_MANUALE` in src/lib/iscrizioni/admin/format.ts.
-- - Nessun consenso privacy: non si è registrato nessuno.
-- - Account e iscrizione stanno nella stessa transazione: se l'iscrizione è
--   rifiutata (posti esauriti, tappa non modificabile) non resta alcun account.
-- - Security definer perché `authenticated` non scrive su `auth.users`; le
--   regole dell'iscrizione restano quelle di `admin_iscrivi_giocatore()`.
-- - Si eliminano come ogni account, eliminando l'utente Auth.

create function public.admin_iscrivi_giocatore_manuale(
  p_tappa uuid,
  p_nome text,
  p_cognome text,
  p_categoria public.categoria
)
returns public.iscrizioni
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_utente uuid := gen_random_uuid();
  v_nome text := coalesce(btrim(p_nome), '');
  v_cognome text := coalesce(btrim(p_cognome), '');
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può iscrivere un giocatore.'
      using errcode = 'insufficient_privilege';
  end if;

  if char_length(v_nome) not between 1 and 100
    or char_length(v_cognome) not between 1 and 100
    or p_categoria is null then
    raise exception 'Servono nome, cognome e categoria del giocatore.'
      using errcode = 'check_violation', hint = 'dati_giocatore_non_validi';
  end if;

  -- Stesse colonne di seed.sql: Supabase Auth non accetta i token nulli.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_utente,
    'authenticated', 'authenticated',
    v_utente::text || '@manuale.blvs.invalid', '', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'nome', v_nome, 'cognome', v_cognome, 'categoria', p_categoria
    ),
    now(), now(), '', '', '', ''
  );

  return public.admin_iscrivi_giocatore(p_tappa, v_utente);
end;
$$;

revoke all on function public.admin_iscrivi_giocatore_manuale(uuid, text, text, public.categoria)
  from public, anon;
grant execute on function public.admin_iscrivi_giocatore_manuale(uuid, text, text, public.categoria)
  to authenticated;
