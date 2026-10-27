-- BLVS-24 · Iscrizione con posto garantito e bozze invisibili.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('c0000000-0000-4000-8000-000000000001', 'primo@example.test', '{"categoria":"M"}', now()),
  ('c0000000-0000-4000-8000-000000000002', 'secondo@example.test', '{"categoria":"M"}', now());

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
values
  ('c0000000-0000-4000-8000-000000001001', 'Tappa aperta', 'Spiaggia',
   '2099-06-10', '2099-06-10', 'iscrizioni_aperte', '2099-06-01 23:59+02'),
  ('c0000000-0000-4000-8000-000000001002', 'Tappa in bozza', 'Spiaggia',
   '2099-07-10', '2099-07-10', 'bozza', null);
update public.tabelloni set posti = 1
where tappa_id = 'c0000000-0000-4000-8000-000000001001';

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select posto from public.iscriviti_tappa('c0000000-0000-4000-8000-000000001001')),
  1,
  'il primo giocatore prende il posto 1'
);
select throws_ok(
  $$ select public.iscriviti_tappa('c0000000-0000-4000-8000-000000001001') $$,
  '23505',
  'Sei già iscritto a questa tappa.',
  'una seconda iscrizione alla stessa tappa è rifiutata'
);
select is(
  (select count(*)::int from public.tabelloni_tappa('c0000000-0000-4000-8000-000000001002')),
  0,
  'i posti di una bozza non si leggono'
);
select throws_ok(
  $$ select public.iscriviti_tappa('c0000000-0000-4000-8000-000000001002') $$,
  'P0002',
  'Tappa non trovata.',
  'iscriversi a una bozza è come a una tappa inesistente'
);

set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ select public.iscriviti_tappa('c0000000-0000-4000-8000-000000001001') $$,
  '23514',
  'Posti esauriti in questo tabellone.',
  'oltre il massimo il server rifiuta'
);
select is(
  (select occupati from public.tabelloni_tappa('c0000000-0000-4000-8000-000000001001') where categoria = 'M'),
  1,
  'il tabellone resta al massimo'
);

reset role;
update public.tappe set iscrizioni_chiudono_il = now() - interval '1 minute'
where id = 'c0000000-0000-4000-8000-000000001001';
update public.tabelloni set posti = 16
where tappa_id = 'c0000000-0000-4000-8000-000000001001';

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.iscriviti_tappa('c0000000-0000-4000-8000-000000001001') $$,
  '23514',
  'Le iscrizioni a questa tappa sono scadute.',
  'dopo la scadenza (orologio del server) il server rifiuta'
);

reset role;
select * from finish();
rollback;
