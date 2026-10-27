-- BLVS-08 · Eventi di gara nel registro, in sola aggiunta.
-- Il registro di BLVS-07 raccoglie già le modifiche tecniche (trigger su
-- insert/update/delete). Qui si aggiungono gli eventi con un significato
-- per l'arbitro e per i giocatori: ognuno ha tipo, autore, data e ora,
-- oggetto, valore prima e dopo.

create type public.tipo_evento_registro as enum (
  'inserimento_punteggio',
  'correzione_punteggio',
  'annullamento_punteggio',
  'ritiro',
  'assenza',
  'parita_risolta',
  'rigenerazione_gironi',
  'cambio_categoria',
  'chiusura_tabellone'
);

alter table public.registro
  add column tipo public.tipo_evento_registro,
  add column valore_prima jsonb,
  add column valore_dopo jsonb,
  add column nota text check (char_length(nota) <= 500),
  -- La stessa istante in ora di Roma, per chi legge il registro a mano.
  add column ora_roma timestamp
    generated always as (created_at at time zone 'Europe/Rome') stored,
  add constraint registro_evento_completo check (
    tipo is null
    or (azione = 'evento' and attore_id is not null and entita_id is not null)
  );

comment on column public.registro.tipo is
  'Tipo di evento di gara; null per le righe scritte dai trigger tecnici.';
comment on column public.registro.ora_roma is
  'created_at in Europe/Rome (ora locale della gara).';

create index registro_entita_idx on public.registro (entita, entita_id, created_at desc);
create index registro_tipo_idx on public.registro (tipo, created_at desc)
  where tipo is not null;

-- ---------------------------------------------------------------------------
-- Sola aggiunta: niente UPDATE, DELETE né TRUNCATE, per nessun ruolo API.
-- I trigger di riga di BLVS-07 bloccano UPDATE e DELETE anche al proprietario;
-- TRUNCATE non passa dai trigger di riga, quindi serve un trigger a parte.
-- ---------------------------------------------------------------------------

create function public.blocca_truncate_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La tabella % è in sola aggiunta', tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger registro_no_truncate
before truncate on public.registro
for each statement execute function public.blocca_truncate_append_only();

revoke update, delete, truncate on public.registro
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Scrittura di un evento
-- ---------------------------------------------------------------------------

-- Con un JWT (admin) l'autore è sempre auth.uid(): p_attore_id è ignorato.
-- Senza JWT (backend con la chiave segreta) l'autore va passato.
create function public.registra_evento(
  p_tipo public.tipo_evento_registro,
  p_entita text,
  p_entita_id text,
  p_valore_prima jsonb default null,
  p_valore_dopo jsonb default null,
  p_nota text default null,
  p_attore_id uuid default null
)
returns public.registro
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := (select auth.uid());
  riga public.registro;
begin
  if utente is not null and not public.is_admin() then
    raise exception 'Solo un admin può scrivere eventi nel registro'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(utente, p_attore_id) is null then
    raise exception 'Un evento del registro deve avere un autore'
      using errcode = 'not_null_violation';
  end if;

  insert into public.registro (
    attore_id, azione, entita, entita_id, tipo, valore_prima, valore_dopo, nota
  )
  values (
    coalesce(utente, p_attore_id),
    'evento',
    p_entita,
    p_entita_id,
    p_tipo,
    p_valore_prima,
    p_valore_dopo,
    p_nota
  )
  returning * into riga;

  return riga;
end;
$$;

revoke all on function public.registra_evento(
  public.tipo_evento_registro, text, text, jsonb, jsonb, text, uuid
) from public, anon;
grant execute on function public.registra_evento(
  public.tipo_evento_registro, text, text, jsonb, jsonb, text, uuid
) to authenticated, service_role;
