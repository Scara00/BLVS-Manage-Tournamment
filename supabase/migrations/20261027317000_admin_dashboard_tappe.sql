-- BLVS-17 · Dashboard admin delle tappe.
--
-- Ogni tabellone (categoria M/F di una tappa) ha i suoi posti e la fase
-- Gold/Silver, che l'admin imposta. `admin_riepilogo_tappe()` dà alla
-- dashboard, in una sola chiamata, tappe (bozze comprese), iscritti e posti
-- per categoria e le partite ancora da inserire.

-- `if not exists`: anche BLVS-19 e BLVS-21 aggiungono `posti`, così le
-- migrazioni si applicano in qualunque ordine.
alter table public.tabelloni
  add column if not exists posti integer not null default 16
    constraint tabelloni_posti check (posti between 1 and 256),
  add column if not exists fase text
    constraint tabelloni_fase check (fase in ('gold', 'silver'));

comment on column public.tabelloni.posti is
  'Posti disponibili nel tabellone (per categoria).';
comment on column public.tabelloni.fase is
  'Fase Gold/Silver mostrata con ★/◆; null finché l''admin non la imposta.';

-- Una partita è «da inserire» quando si sta giocando, o quando l'orario
-- previsto è passato e il punteggio è ancora vuoto.
create function public.admin_riepilogo_tappe()
returns table (
  id uuid,
  nome text,
  data_inizio date,
  data_fine date,
  stato public.stato_tappa,
  categorie jsonb,
  partite_da_inserire integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Riepilogo riservato agli admin'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    t.id,
    t.nome,
    t.data_inizio,
    t.data_fine,
    t.stato,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'categoria', tb.categoria,
            'posti', tb.posti,
            'fase', tb.fase,
            'iscritti', (
              select count(*)
              from public.iscrizioni i
              where i.tabellone_id = tb.id
                and i.stato in ('in_attesa', 'confermata')
            )
          )
          order by tb.categoria
        )
        from public.tabelloni tb
        where tb.tappa_id = t.id
      ),
      '[]'::jsonb
    ),
    (
      select count(*)::integer
      from public.partite p
      join public.tabelloni tb on tb.id = p.tabellone_id
      left join public.punteggi pt on pt.partita_id = p.id
      where tb.tappa_id = t.id
        and (
          p.stato = 'in_corso'
          or (
            p.stato = 'programmata'
            and p.programmata_il <= now()
            and coalesce(jsonb_array_length(pt.sets), 0) = 0
          )
        )
    )
  from public.tappe t
  order by t.data_inizio, t.nome;
end;
$$;

revoke execute on function public.admin_riepilogo_tappe() from public, anon;
grant execute on function public.admin_riepilogo_tappe() to authenticated;
