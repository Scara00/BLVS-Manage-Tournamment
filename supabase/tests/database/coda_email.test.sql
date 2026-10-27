-- BLVS-08 · Coda email: tentativi, errori registrati, accesso solo backend.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into public.coda_email (id, destinatario, modello, oggetto, html, testo, max_tentativi)
values (
  'e0000000-0000-4000-8000-000000000001', 'giocatore@example.test',
  'tappa-annullata', 'Tappa annullata', '<p>x</p>', 'x', 2
);

select is(
  (select tentativi from public.prendi_email_da_inviare(10)),
  1,
  'prendere un’email conta un tentativo'
);
select is(
  (select count(*)::int from public.prendi_email_da_inviare(10)),
  0,
  'un’email in invio non viene presa due volte'
);

select lives_ok(
  $$ select public.chiudi_tentativo_email(
       'e0000000-0000-4000-8000-000000000001', 'SMTP 451', now() - interval '1 second'
     ) $$,
  'un errore rimette l’email in coda'
);
select results_eq(
  $$ select stato::text, ultimo_errore from public.coda_email $$,
  $$ values ('in_coda', 'SMTP 451') $$,
  'stato in coda con l’ultimo errore'
);

select is(
  (select tentativi from public.prendi_email_da_inviare(10)),
  2,
  'il secondo tentativo è contato'
);
select lives_ok(
  $$ select public.chiudi_tentativo_email(
       'e0000000-0000-4000-8000-000000000001', 'SMTP 550', null
     ) $$,
  'all’ultimo tentativo l’email fallisce'
);
select results_eq(
  $$ select tentativo, riuscito, errore from public.tentativi_email order by tentativo $$,
  $$ values (1, false, 'SMTP 451'), (2, false, 'SMTP 550') $$,
  'ogni errore è registrato'
);
select is(
  (select stato::text from public.coda_email),
  'fallita',
  'email fallita'
);

-- Il worker può essere avviato anche senza segreti nel Vault: non fa nulla.
select lives_ok($$ select public.avvia_worker_email() $$, 'avvio del worker innocuo');

set local role authenticated;
set local request.jwt.claims to '{"sub": "a0000000-0000-4000-8000-000000000009", "role": "authenticated"}';
select throws_ok(
  $$ select * from public.coda_email $$,
  '42501', null, 'un utente non legge la coda'
);
select throws_ok(
  $$ select * from public.prendi_email_da_inviare(1) $$,
  '42501', null, 'un utente non avvia gli invii'
);
reset role;

select * from finish();
rollback;
