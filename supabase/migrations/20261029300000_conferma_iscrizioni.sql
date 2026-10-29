-- Conferma delle iscrizioni da admin (w-admin-iscritti).
--
-- Generazione, editor e rigenerazione dei gironi e avvio delle fasi contano
-- solo le iscrizioni `confermata`. Chi si iscrive da sé resta `in_attesa`
-- (solo le aggiunte dall'admin nascono confermate) e nessuna funzione lo
-- confermava: quei giocatori non entravano mai nei gironi.
--
-- `admin_conferma_iscrizioni(tappa, iscrizioni)` conferma le iscrizioni in
-- attesa della tappa: quelle indicate, o tutte con `p_iscrizioni` nullo.
-- Stesse regole di aggiunta e rimozione (BLVS-25): solo admin, solo finché
-- gli iscritti si possono modificare (bozza, iscrizioni aperte o chiuse).
-- Ritorna quante ne ha confermate; un'iscrizione indicata che non è più
-- attiva è un errore (`iscrizione_non_trovata`), una già confermata no.

create function public.admin_conferma_iscrizioni(
  p_tappa uuid,
  p_iscrizioni uuid[] default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_stato public.stato_tappa;
  v_confermate integer;
begin
  if not public.is_admin() then
    raise exception 'Solo l''amministrazione può confermare le iscrizioni.'
      using errcode = 'insufficient_privilege';
  end if;

  select stato into v_stato from public.tappe where id = p_tappa;
  if not found then
    raise exception 'Tappa non trovata.' using errcode = 'no_data_found';
  end if;
  if v_stato = 'archiviata' then
    raise exception 'Tappa archiviata: consultabile ma non modificabile'
      using errcode = 'check_violation', hint = 'tappa_archiviata';
  end if;
  if v_stato = 'annullata' then
    raise exception 'La tappa è annullata: gli iscritti non cambiano più'
      using errcode = 'check_violation', hint = 'tappa_annullata';
  end if;
  if not public.tappa_iscritti_modificabili(v_stato) then
    raise exception 'Con la tappa in corso o conclusa gli iscritti non cambiano più.'
      using errcode = 'check_violation', hint = 'tappa_non_iscrivibile';
  end if;

  if p_iscrizioni is not null and exists (
    select 1 from unnest(p_iscrizioni) as richiesta(id)
    where not exists (
      select 1 from public.iscrizioni i
      where i.id = richiesta.id
        and i.tappa_id = p_tappa
        and i.stato in ('in_attesa', 'confermata')
    )
  ) then
    raise exception 'L''iscrizione non è più attiva.'
      using errcode = 'no_data_found', hint = 'iscrizione_non_trovata';
  end if;

  update public.iscrizioni
  set stato = 'confermata'
  where tappa_id = p_tappa
    and stato = 'in_attesa'
    and (p_iscrizioni is null or id = any (p_iscrizioni));
  get diagnostics v_confermate = row_count;

  return v_confermate;
end;
$$;

revoke all on function public.admin_conferma_iscrizioni(uuid, uuid[]) from public, anon;
grant execute on function public.admin_conferma_iscrizioni(uuid, uuid[]) to authenticated;
