-- BLVS-25 · Iscritti gestiti dall'admin: massimo, unicità, posto liberato.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('d0000000-0000-4000-8000-000000000001', 'admin@example.test', '{"categoria":"M"}', now()),
  ('d0000000-0000-4000-8000-000000000002', 'primo@example.test', '{"categoria":"M"}', now()),
  ('d0000000-0000-4000-8000-000000000003', 'secondo@example.test', '{"categoria":"M"}', now());
update public.utenti set ruolo = 'admin' where id = 'd0000000-0000-4000-8000-000000000001';

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato, iscrizioni_chiudono_il)
values
  ('d0000000-0000-4000-8000-000000001001', 'Tappa chiusa', 'Spiaggia',
   '2099-06-10', '2099-06-10', 'iscrizioni_chiuse', '2099-06-01 23:59+02');
update public.tabelloni set posti = 1
where tappa_id = 'd0000000-0000-4000-8000-000000001001';

set local role authenticated;
set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select posto from public.admin_iscrivi_giocatore(
    'd0000000-0000-4000-8000-000000001001', 'd0000000-0000-4000-8000-000000000002')),
  1,
  'a iscrizioni chiuse l''admin iscrive al posto 1'
);
select throws_ok(
  $$ select public.admin_iscrivi_giocatore(
    'd0000000-0000-4000-8000-000000001001', 'd0000000-0000-4000-8000-000000000002') $$,
  '23505',
  'Il giocatore è già iscritto a questa tappa.',
  'un duplicato è rifiutato'
);
select throws_ok(
  $$ select public.admin_iscrivi_giocatore(
    'd0000000-0000-4000-8000-000000001001', 'd0000000-0000-4000-8000-000000000003') $$,
  '23514',
  'Posti esauriti in questo tabellone.',
  'oltre il massimo l''admin è rifiutato'
);
select is(
  (select stato::text from public.admin_rimuovi_iscrizione(
    (select id from public.iscrizioni
     where utente_id = 'd0000000-0000-4000-8000-000000000002'))),
  'ritirata',
  'la rimozione ritira l''iscrizione'
);
select is(
  (select posto from public.admin_iscrivi_giocatore(
    'd0000000-0000-4000-8000-000000001001', 'd0000000-0000-4000-8000-000000000003')),
  1,
  'il posto liberato torna disponibile'
);

set local request.jwt.claims to '{"sub": "d0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.admin_iscrivi_giocatore(
    'd0000000-0000-4000-8000-000000001001', 'd0000000-0000-4000-8000-000000000002') $$,
  '42501',
  'Solo l''amministrazione può iscrivere un giocatore.',
  'un giocatore non può usarla'
);

reset role;
select * from finish();
rollback;
