-- BLVS-08 · Il registro è in sola aggiunta (supabase test db, Postgres reale).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email)
values
  ('a0000000-0000-4000-8000-000000000001', 'admin.registro@example.test'),
  ('a0000000-0000-4000-8000-000000000002', 'giocatore.registro@example.test');
update public.utenti set ruolo = 'admin'
where id = 'a0000000-0000-4000-8000-000000000001';

select enum_has_labels(
  'public', 'tipo_evento_registro',
  array[
    'inserimento_punteggio', 'correzione_punteggio', 'annullamento_punteggio',
    'ritiro', 'assenza', 'parita_risolta', 'rigenerazione_gironi',
    'cambio_categoria', 'chiusura_tabellone'
  ],
  'tutti i tipi di evento richiesti'
);

-- Il backend (nessun JWT) scrive un evento indicando l'autore.
select lives_ok(
  $$ select public.registra_evento(
       'correzione_punteggio', 'punteggi', '42',
       '{"set1": [21, 18]}', '{"set1": [21, 19]}', 'Errore di battitura',
       'a0000000-0000-4000-8000-000000000001'
     ) $$,
  'il backend scrive un evento con autore'
);

select results_eq(
  $$ select tipo::text, attore_id, entita, entita_id, valore_prima, valore_dopo,
            ora_roma = (created_at at time zone 'Europe/Rome')
     from public.registro where tipo is not null $$,
  $$ values ('correzione_punteggio', 'a0000000-0000-4000-8000-000000000001'::uuid,
             'punteggi', '42', '{"set1": [21, 18]}'::jsonb,
             '{"set1": [21, 19]}'::jsonb, true) $$,
  'la voce ha tipo, autore, oggetto, valore prima e dopo, ora di Roma'
);

select throws_ok(
  $$ select public.registra_evento('ritiro', 'iscrizioni', '1') $$,
  '23502', null,
  'un evento senza autore è rifiutato'
);

-- Nemmeno il proprietario della tabella può modificare o cancellare.
select throws_ok(
  $$ update public.registro set nota = 'modificata' $$,
  '42501', null, 'UPDATE negato al proprietario'
);
select throws_ok(
  $$ delete from public.registro $$,
  '42501', null, 'DELETE negato al proprietario'
);
select throws_ok(
  $$ truncate public.registro $$,
  '42501', null, 'TRUNCATE negato al proprietario'
);

-- Nessun ruolo API ha i privilegi di modifica.
select ok(
  not has_table_privilege(r, 'public.registro', p),
  format('%s non ha %s sul registro', r, p)
)
from unnest(array['anon', 'authenticated', 'service_role']) as r,
     unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) as p
where (r, p) in (('anon', 'UPDATE'), ('authenticated', 'DELETE'),
                 ('service_role', 'UPDATE'), ('service_role', 'DELETE'),
                 ('service_role', 'TRUNCATE'));

-- Admin con sessione: l'autore è sempre auth.uid().
set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000001", "role": "authenticated"}';

select is(
  (select attore_id from public.registra_evento(
     'chiusura_tabellone', 'tabelloni', 't1', null, null, null,
     'a0000000-0000-4000-8000-000000000002'
   )),
  'a0000000-0000-4000-8000-000000000001'::uuid,
  "con una sessione l'autore è l'utente, non quello passato"
);

select throws_ok(
  $$ update public.registro set nota = 'x' $$,
  '42501', null, "l'admin non può modificare il registro"
);

-- Giocatore: non scrive eventi.
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.registra_evento('assenza', 'iscrizioni', '3') $$,
  '42501', null, 'un giocatore non scrive nel registro'
);

reset role;

select is(
  (select count(*)::int from public.registro where tipo is not null),
  2,
  'restano solo le voci aggiunte, intatte'
);

select * from finish();
rollback;
