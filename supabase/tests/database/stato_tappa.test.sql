-- BLVS-20 · Stato delle iscrizioni: transizioni e chiusura automatica.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('c0000000-0000-4000-8000-000000000001', 'admin-stato@example.test', '{"categoria":"M"}');
update public.utenti set ruolo = 'admin'
where id = 'c0000000-0000-4000-8000-000000000001';

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
values
  ('c0000000-0000-4000-8000-000000001001', 'Bozza', 'Spiaggia',
   '2099-07-01', '2099-07-02', 'bozza', '2099-06-01 23:59+02'),
  ('c0000000-0000-4000-8000-000000001002', 'Senza scadenza', 'Spiaggia',
   '2099-07-01', '2099-07-02', 'bozza', null),
  ('c0000000-0000-4000-8000-000000001003', 'Scaduta', 'Spiaggia',
   '2099-07-01', '2099-07-02', 'iscrizioni_aperte', '2020-06-01 23:59+02');

set local role authenticated;
set local request.jwt.claims to '{"sub": "c0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ update public.tappe set stato = 'iscrizioni_chiuse' where id = 'c0000000-0000-4000-8000-000000001001' $$,
  '23514',
  null,
  'bozza → chiuse non è permesso, neanche all''admin'
);
select throws_ok(
  $$ update public.tappe set stato = 'iscrizioni_aperte' where id = 'c0000000-0000-4000-8000-000000001002' $$,
  '23514',
  'Le iscrizioni si aprono solo con una scadenza futura',
  'senza scadenza le iscrizioni non si aprono'
);
select lives_ok(
  $$ update public.tappe set stato = 'iscrizioni_aperte' where id = 'c0000000-0000-4000-8000-000000001001' $$,
  'l''admin apre le iscrizioni di una bozza con scadenza futura'
);
select lives_ok(
  $$ update public.tappe set stato = 'iscrizioni_chiuse' where id = 'c0000000-0000-4000-8000-000000001001' $$,
  'l''admin chiude le iscrizioni aperte'
);
select is(
  (select chiusura_automatica from public.tappe where id = 'c0000000-0000-4000-8000-000000001001'),
  false,
  'una chiusura a mano non è automatica'
);

reset role;
set local role service_role;
select is(public.chiudi_iscrizioni_scadute() >= 1, true, 'il job chiude le tappe scadute');
reset role;
select is(
  (select stato::text || '/' || chiusura_automatica::text from public.tappe
   where id = 'c0000000-0000-4000-8000-000000001003'),
  'iscrizioni_chiuse/true',
  'la tappa scaduta risulta chiusa automaticamente'
);

select * from finish();
rollback;
