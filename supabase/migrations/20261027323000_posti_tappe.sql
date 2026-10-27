-- BLVS-23 · Elenco delle tappe per i giocatori (w-tappe).
--
-- Il giocatore vede «N liberi su M» nella propria categoria, ma la policy
-- `iscrizioni_select` gli mostra solo le sue iscrizioni: `posti_tappe()`
-- conta i posti occupati lato server e restituisce solo i numeri, mai chi è
-- iscritto. Le bozze restano nascoste a tutti.

-- La colonna `posti` la introducono anche BLVS-17 e BLVS-19: `if not exists`
-- così le migrazioni si applicano in qualunque ordine.
alter table public.tabelloni
  add column if not exists posti integer not null default 16;

-- Per ogni tabellone delle tappe non in bozza: posti, posti occupati
-- (iscrizioni in attesa o confermate, la stessa regola di stato_categoria)
-- e, solo per le tappe in corso, la fase più avanzata delle sue partite.
create function public.posti_tappe()
returns table (
  tappa_id uuid,
  categoria public.categoria,
  posti integer,
  occupati integer,
  fase text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tb.tappa_id,
    tb.categoria,
    tb.posti,
    (
      select count(*)::integer
      from public.iscrizioni i
      where i.tabellone_id = tb.id
        and i.stato in ('in_attesa', 'confermata')
    ) as occupati,
    case
      when t.stato = 'in_corso' then (
        select p.fase
        from public.partite p
        where p.tabellone_id = tb.id
        order by case p.fase
          when 'finale' then 3
          when 'eliminazione' then 2
          else 1
        end desc
        limit 1
      )
    end as fase
  from public.tabelloni tb
  join public.tappe t on t.id = tb.tappa_id
  where t.stato <> 'bozza';
$$;

revoke all on function public.posti_tappe() from public;
grant execute on function public.posti_tappe() to anon, authenticated, service_role;
