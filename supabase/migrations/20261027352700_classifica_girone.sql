-- BLVS-27 · Classifica del girone e spareggi (R-39, R-40).
-- La classifica non si salva: si ricalcola in TS (src/lib/gironi/classifica)
-- dalle partite del girone a ogni lettura, così ogni punteggio salvato,
-- corretto o annullato vale subito. Qui resta solo la decisione dell'admin
-- su una parità perfetta, legata alla «firma» della parità: se un punteggio
-- cambia i numeri dei giocatori pari, la firma cambia e la parità torna
-- «da risolvere».

create table public.spareggi_girone (
  id uuid primary key default gen_random_uuid(),
  girone_id uuid not null references public.gironi (id) on delete cascade,
  -- «<iscrizione>:<giocate>/<vinte>/<fatti>/<subiti>|…», iscrizioni in ordine.
  firma text not null check (char_length(firma) between 1 and 2000),
  -- Le iscrizioni pari, dalla migliore.
  ordine uuid[] not null check (cardinality(ordine) >= 2),
  motivo text not null check (char_length(motivo) between 1 and 500),
  deciso_da uuid references public.utenti (id) on delete set null
    default auth.uid(),
  deciso_il timestamptz not null default now(),
  constraint spareggi_girone_firma_key unique (girone_id, firma)
);

comment on table public.spareggi_girone is
  'Ordine deciso dall''admin per una parità perfetta del girone (BLVS-27).';

alter table public.spareggi_girone enable row level security;

grant select on public.spareggi_girone to anon, authenticated;
grant insert, update, delete on public.spareggi_girone to authenticated;

-- Come gli altri dati di gara: pubblici in lettura, scritti dall'admin.
create policy spareggi_girone_select on public.spareggi_girone
for select to anon, authenticated using (true);
create policy spareggi_girone_admin on public.spareggi_girone
for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger spareggi_girone_registro
after insert or update or delete on public.spareggi_girone
for each row execute function public.scrivi_registro();

-- Una tappa archiviata non si tocca (BLVS-22), nemmeno nelle parità.
create function public.spareggi_girone_blocca_tappa_archiviata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_girone uuid := case when tg_op = 'DELETE' then old.girone_id else new.girone_id end;
begin
  if exists (
    select 1
    from public.gironi g
    join public.tabelloni tb on tb.id = g.tabellone_id
    join public.tappe t on t.id = tb.tappa_id
    where g.id = v_girone and t.stato = 'archiviata'
  ) then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger spareggi_girone_blocca_tappa_archiviata
before insert or update or delete on public.spareggi_girone
for each row execute function public.spareggi_girone_blocca_tappa_archiviata();

-- ---------------------------------------------------------------------------
-- RPC: l'admin decide l'ordine di una parità perfetta
-- ---------------------------------------------------------------------------

-- Security invoker: RLS e trigger valgono come per l'admin. Controlla che
-- l'ordine elenchi una volta ciascun giocatore della firma e che siano
-- tutti del girone; che la parità esista ancora lo verifica il TS, che
-- conosce i criteri (risolviParitaGirone).
create function public.risolvi_parita_girone(
  p_girone uuid,
  p_firma text,
  p_ordine uuid[],
  p_motivo text
)
returns public.spareggi_girone
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_firma uuid[];
  v_riga public.spareggi_girone;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può decidere una parità'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.gironi where id = p_girone) then
    raise exception 'Girone non trovato'
      using errcode = 'no_data_found', hint = 'girone_non_trovato';
  end if;

  if v_motivo is null then
    raise exception 'Scrivi come è stata decisa la parità'
      using errcode = 'check_violation', hint = 'motivo_mancante';
  end if;

  begin
    select array_agg(split_part(parte, ':', 1)::uuid)
    into v_firma
    from unnest(string_to_array(coalesce(p_firma, ''), '|')) parte;
  exception when invalid_text_representation then
    v_firma := null;
  end;

  if p_ordine is null
     or cardinality(p_ordine) < 2
     or v_firma is null
     or cardinality(p_ordine) <> cardinality(v_firma)
     or (select count(distinct x) from unnest(p_ordine) x) <> cardinality(p_ordine)
     or not (p_ordine <@ v_firma and v_firma <@ p_ordine)
     or (
       select count(*)
       from public.girone_iscrizioni gi
       where gi.girone_id = p_girone and gi.iscrizione_id = any (p_ordine)
     ) <> cardinality(p_ordine)
  then
    raise exception 'L''ordine deve elencare una volta ciascun giocatore pari del girone'
      using errcode = 'check_violation', hint = 'ordine_non_valido';
  end if;

  insert into public.spareggi_girone (girone_id, firma, ordine, motivo)
  values (p_girone, p_firma, p_ordine, v_motivo)
  on conflict (girone_id, firma) do update
    set ordine = excluded.ordine,
        motivo = excluded.motivo,
        deciso_da = auth.uid(),
        deciso_il = now()
  returning * into v_riga;

  return v_riga;
end;
$$;

revoke all on function public.risolvi_parita_girone(uuid, text, uuid[], text)
  from public, anon;
grant execute on function public.risolvi_parita_girone(uuid, text, uuid[], text)
  to authenticated;
