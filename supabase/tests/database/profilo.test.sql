-- BLVS-16 · Profilo: la categoria si blocca dopo la prima tappa giocata.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-4000-8000-000000000001', 'libero@example.test', '{"categoria":"M"}'),
  ('b0000000-0000-4000-8000-000000000002', 'bloccato@example.test', '{"categoria":"M"}');

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato)
values ('b0000000-0000-4000-8000-000000001001', 'Tappa giocata', 'Spiaggia',
        '2027-06-01', '2027-06-02', 'iscrizioni_aperte');
insert into public.iscrizioni (tappa_id, tabellone_id, utente_id, stato)
select t.tappa_id, t.id, 'b0000000-0000-4000-8000-000000000002', 'confermata'
from public.tabelloni t
where t.tappa_id = 'b0000000-0000-4000-8000-000000001001' and t.categoria = 'M';
update public.tappe set stato = 'conclusa'
where id = 'b0000000-0000-4000-8000-000000001001';

set local role authenticated;
set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(public.stato_categoria(), 'modificabile', 'senza tappe giocate la categoria è modificabile');
select lives_ok(
  $$ update public.utenti set categoria = 'F' where id = 'b0000000-0000-4000-8000-000000000001' $$,
  'il giocatore cambia la propria categoria'
);

set local request.jwt.claims to '{"sub": "b0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select is(public.stato_categoria(), 'bloccata', 'dopo una tappa conclusa la categoria è bloccata');
select throws_ok(
  $$ update public.utenti set categoria = 'F' where id = 'b0000000-0000-4000-8000-000000000002' $$,
  '23514',
  'La categoria non si può più cambiare dopo la prima tappa giocata',
  'il server rifiuta il cambio di categoria'
);
select lives_ok(
  $$ update public.utenti set nome = 'Nuovo' where id = 'b0000000-0000-4000-8000-000000000002' $$,
  'nome e cognome restano modificabili'
);

reset role;
select * from finish();
rollback;
