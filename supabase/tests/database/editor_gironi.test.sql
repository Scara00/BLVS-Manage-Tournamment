-- BLVS-28 · Editor dei gironi: spostamento, scambio, versione, blocco.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-4000-8000-000000000001', 'admin-gironi@example.test', '{"categoria":"M"}'),
  ('e0000000-0000-4000-8000-000000000002', 'g1-gironi@example.test', '{"categoria":"M"}'),
  ('e0000000-0000-4000-8000-000000000003', 'g2-gironi@example.test', '{"categoria":"M"}');
update public.utenti set ruolo = 'admin'
where id = 'e0000000-0000-4000-8000-000000000001';

insert into public.tappe (id, nome, luogo, data_inizio, data_fine, stato)
values ('e0000000-0000-4000-8000-000000001001', 'Gironi', 'Spiaggia',
        '2099-07-01', '2099-07-02', 'iscrizioni_chiuse');

insert into public.iscrizioni (id, tappa_id, tabellone_id, utente_id, stato)
select v.id::uuid, tb.tappa_id, tb.id, v.utente::uuid, 'confermata'
from public.tabelloni tb
cross join (values
  ('e0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-000000002002', 'e0000000-0000-4000-8000-000000000003')
) as v (id, utente)
where tb.tappa_id = 'e0000000-0000-4000-8000-000000001001' and tb.categoria = 'M';

insert into public.gironi (id, tabellone_id, nome, posizione)
select v.id::uuid, tb.id, v.nome, v.pos
from public.tabelloni tb
cross join (values
  ('e0000000-0000-4000-8000-000000003001', 'Girone A', 1),
  ('e0000000-0000-4000-8000-000000003002', 'Girone B', 2)
) as v (id, nome, pos)
where tb.tappa_id = 'e0000000-0000-4000-8000-000000001001' and tb.categoria = 'M';

insert into public.girone_iscrizioni (girone_id, iscrizione_id) values
  ('e0000000-0000-4000-8000-000000003001', 'e0000000-0000-4000-8000-000000002001'),
  ('e0000000-0000-4000-8000-000000003002', 'e0000000-0000-4000-8000-000000002002');

create temporary table t_tab on commit drop as
select id from public.tabelloni
where tappa_id = 'e0000000-0000-4000-8000-000000001001' and categoria = 'M';
grant select on t_tab to authenticated;

set local role authenticated;
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select public.scambia_in_girone((select id from t_tab), 0,
     'e0000000-0000-4000-8000-000000002001', 'e0000000-0000-4000-8000-000000002002')),
  1,
  'lo scambio alza la versione dei gironi'
);
select results_eq(
  $$ select girone_id::text from public.girone_iscrizioni
     where iscrizione_id = 'e0000000-0000-4000-8000-000000002001' $$,
  $$ values ('e0000000-0000-4000-8000-000000003002') $$,
  'dopo lo scambio il giocatore è nell''altro girone'
);
select throws_ok(
  $$ select public.sposta_in_girone((select id from t_tab), 0,
       'e0000000-0000-4000-8000-000000002001', null) $$,
  '40001',
  'I gironi sono cambiati nel frattempo',
  'una versione superata è un conflitto'
);
select is(
  (select public.sposta_in_girone((select id from t_tab), 1,
     'e0000000-0000-4000-8000-000000002001', null)),
  2,
  'sposta tra i non assegnati'
);
select is(
  (select jsonb_array_length(public.gironi_editor((select id from t_tab)) -> 'non_assegnati')),
  1,
  'l''editor legge i non assegnati'
);

reset role;
insert into public.partite (tabellone_id, girone_id, stato)
select id, 'e0000000-0000-4000-8000-000000003001', 'in_corso' from t_tab;

set local role authenticated;
set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok(
  $$ select public.aggiungi_girone((select id from t_tab), 2) $$,
  '23514',
  'Le partite dei gironi sono iniziate: i gironi non si modificano più',
  'con una partita iniziata i gironi sono bloccati'
);

set local request.jwt.claims to '{"sub": "e0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.gironi_editor((select id from t_tab)) $$,
  '42501',
  'Solo un amministratore può modificare i gironi',
  'un giocatore non legge l''editor'
);

select * from finish();
rollback;
