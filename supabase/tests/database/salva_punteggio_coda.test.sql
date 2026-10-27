-- BLVS-33 · Coda dei punteggi: una chiave salva una volta sola.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('f3300000-0000-4000-8000-000000000001', 'admin-coda@example.test', '{"categoria":"M"}'),
  ('f3300000-0000-4000-8000-000000000002', 'g-coda@example.test', '{"categoria":"M"}');
update public.utenti set ruolo = 'admin'
where id = 'f3300000-0000-4000-8000-000000000001';

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato)
values ('f3300000-0000-4000-8000-000000001001', 'Coda', 'Spiaggia',
        '2099-07-01', '2099-07-02', 'in_corso');

insert into public.partite (id, tabellone_id, fase, turno)
select 'f3300000-0000-4000-8000-000000002001', id, 'gironi', 1
from public.tabelloni
where tappa_id = 'f3300000-0000-4000-8000-000000001001' and categoria = 'M';

set local role authenticated;
set local request.jwt.claims to '{"sub": "f3300000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (public.salva_punteggio_coda(
    'f3300000-0000-4000-8000-000000002001', 1, '[{"a":21,"b":19}]',
    'f3300000-0000-4000-8000-00000000c001') ->> 'duplicato')::boolean,
  false,
  'il primo invio salva'
);

select is(
  (public.salva_punteggio_coda(
    'f3300000-0000-4000-8000-000000002001', 1, '[{"a":21,"b":19}]',
    'f3300000-0000-4000-8000-00000000c001') ->> 'duplicato')::boolean,
  true,
  'lo stesso invio ripetuto non salva di nuovo'
);

select is(
  (select versione from public.punteggi
   where partita_id = 'f3300000-0000-4000-8000-000000002001'),
  2,
  'una sola modifica della versione'
);

select throws_ok(
  $$ select public.salva_punteggio_coda(
       'f3300000-0000-4000-8000-000000002001', 1, '[{"a":21,"b":10}]',
       'f3300000-0000-4000-8000-00000000c002') $$,
  '40001',
  null,
  'una versione superata è un conflitto'
);

select is(
  (select count(*)::int from public.punteggi_invii
   where partita_id = 'f3300000-0000-4000-8000-000000002001'),
  1,
  'una chiave registrata'
);

set local request.jwt.claims to '{"sub": "f3300000-0000-4000-8000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ select public.salva_punteggio_coda(
       'f3300000-0000-4000-8000-000000002001', 2, '[{"a":21,"b":10}]',
       'f3300000-0000-4000-8000-00000000c003') $$,
  '42501',
  null,
  'un giocatore non salva punteggi'
);

select * from finish();
rollback;
