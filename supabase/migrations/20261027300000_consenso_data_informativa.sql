-- BLVS-12 · Il consenso privacy registra anche la data della versione
-- dell'informativa accettata (PRIVACY_POLICY_VERSION in
-- src/lib/legal/privacy-policy.ts). Il momento del consenso è created_at.

-- Facoltativa: le righe precedenti non ce l'hanno.
alter table public.consensi add column data_informativa date;

-- Come in 20261027100100_auth_audit_rls.sql, più `consenso_privacy_data`
-- (YYYY-MM-DD). Una data non valida si scarta: il consenso resta registrato.
create or replace function public.gestisci_nuovo_utente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  categoria_meta text := meta ->> 'categoria';
  data_meta text := meta ->> 'consenso_privacy_data';
  data_accettata date;
begin
  insert into public.utenti (id, email, nome, cognome, categoria)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'nome', ''), 100),
    left(coalesce(meta ->> 'cognome', ''), 100),
    case when categoria_meta in ('M', 'F')
      then categoria_meta::public.categoria end
  );

  if nullif(meta ->> 'consenso_privacy', '') is not null then
    if data_meta ~ '^\d{4}-\d{2}-\d{2}$' then
      begin
        data_accettata := data_meta::date;
      exception when others then
        data_accettata := null;
      end;
    end if;

    insert into public.consensi
      (utente_id, tipo, versione_informativa, data_informativa, concesso)
    values (
      new.id,
      'privacy',
      left(meta ->> 'consenso_privacy', 40),
      data_accettata,
      true
    );
  end if;

  return new;
end;
$$;
