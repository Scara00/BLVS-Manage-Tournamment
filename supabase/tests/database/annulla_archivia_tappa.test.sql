-- BLVS-22 · Annullamento e archiviazione di una tappa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-000000000001', 'admin-annulla@example.test', '{"categoria":"M"}'),
  ('d0000000-0000-4000-8000-000000000002', 'iscritto-annulla@example.test', '{"categoria":"M"}');
update public.utenti set ruolo = 'admin'
where id = 'd0000000-0000-4000-8000-000000000001';

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato)
values
  ('d0000000-0000-4000-8000-000000001001', 'Da annullare', 'Spiaggia',
   '2099-07-01', '2099-07-02', 'iscrizioni_chiuse'),
  ('d0000000-0000-4000-8000-000000001002', 'Conclusa', 'Spiaggia',
   '2099-07-01', '2099-07-02', 'conclusa');

insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
select tappa_id, id, 'd0000000-0000-4000-8000-000000000002'
from public.tabelloni
where tappa_id = 'd0000000-0000-4000-8000-000000001001' and categoria = 'M';

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select * from public.annulla_tappa('d0000000-0000-4000-8000-000000001001', '  ') $$,
  '23514',
  'Indica il motivo dell''annullamento',
  'il motivo è obbligatorio'
);
select results_eq(
  $$ select email from public.annulla_tappa('d0000000-0000-4000-8000-000000001001', 'Maltempo') $$,
  $$ values ('iscritto-annulla@example.test'::text) $$,
  'annulla e restituisce gli iscritti da avvisare'
);
select throws_ok(
  $$ update public.tappe set stato = 'archiviata' where id = 'd0000000-0000-4000-8000-000000001002' $$,
  '23514',
  'Potrai archiviare la tappa dopo la chiusura dei risultati di entrambi i tabelloni',
  'non si archivia prima della chiusura dei tabelloni'
);

reset role;
update public.tabelloni set concluso_il = now()
where tappa_id = 'd0000000-0000-4000-8000-000000001002';
select throws_ok(
  $$ insert into public.iscrizioni (tappa_id, tabellone_id, utente_id)
     select tappa_id, id, 'd0000000-0000-4000-8000-000000000001'
     from public.tabelloni
     where tappa_id = 'd0000000-0000-4000-8000-000000001001' and categoria = 'M' $$,
  '23514',
  'La tappa è annullata: non accetta nuove iscrizioni',
  'una tappa annullata non accetta iscrizioni, nemmeno dal backend'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ update public.tappe set stato = 'archiviata' where id = 'd0000000-0000-4000-8000-000000001002' $$,
  'con entrambi i tabelloni conclusi si archivia'
);
select throws_ok(
  $$ update public.tappe set nome = 'Altro' where id = 'd0000000-0000-4000-8000-000000001002' $$,
  '23514',
  'Tappa archiviata: consultabile ma non modificabile',
  'una tappa archiviata non si modifica'
);
select is(
  (select stato::text from public.tappe where id = 'd0000000-0000-4000-8000-000000001002'),
  'archiviata',
  'resta consultabile'
);

select * from finish();
rollback;
