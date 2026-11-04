-- Giocatori aggiunti a mano: niente doppioni.
--
-- La prima versione creava sempre un account nuovo: riscrivere lo stesso
-- giocatore in un'altra tappa dava due persone con classifiche separate.
-- Ora un giocatore aggiunto a mano con lo stesso nome, cognome e categoria
-- (maiuscole a parte) è la stessa persona e viene iscritto lui; le regole
-- dell'iscrizione restano quelle di `admin_iscrivi_giocatore()`, quindi nella
-- stessa tappa è `gia_iscritto`.
--
-- Il riuso vale solo per gli account aggiunti a mano: con un account vero il
-- nome non basta a dire che è la stessa persona, e iscriverla al posto suo
-- sarebbe peggio di un doppione.

create or replace function public.admin_iscrivi_giocatore_manuale(
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
  v_utente uuid;
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

  select id into v_utente
  from public.utenti
  where email::text like '%@manuale.blvs.invalid'
    and lower(nome) = lower(v_nome)
    and lower(cognome) = lower(v_cognome)
    and categoria = p_categoria
  order by created_at
  limit 1;

  if v_utente is null then
    v_utente := gen_random_uuid();

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
  end if;

  return public.admin_iscrivi_giocatore(p_tappa, v_utente);
end;
$$;
