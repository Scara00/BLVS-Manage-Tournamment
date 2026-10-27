-- Dati demo per lo sviluppo locale (`supabase db reset`). MAI in produzione.
-- Tutti gli account hanno la password «Demo-BLVS-2026!» (hash bcrypt di
-- Supabase Auth, calcolato qui con pgcrypto).

-- ---------------------------------------------------------------------------
-- Account (auth.users + auth.identities); il trigger crea public.utenti
-- ---------------------------------------------------------------------------

with account (id, email, meta) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@blvs.test',
     '{"nome":"Alessandra","cognome":"Admin"}'::jsonb),
    ('00000000-0000-4000-8000-000000000101'::uuid, 'marco.rossi@blvs.test',
     '{"nome":"Marco","cognome":"Rossi","categoria":"M","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000102'::uuid, 'luca.bianchi@blvs.test',
     '{"nome":"Luca","cognome":"Bianchi","categoria":"M","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000103'::uuid, 'paolo.esposito@blvs.test',
     '{"nome":"Paolo","cognome":"Esposito","categoria":"M","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000104'::uuid, 'andrea.romano@blvs.test',
     '{"nome":"Andrea","cognome":"Romano","categoria":"M","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000201'::uuid, 'giulia.colombo@blvs.test',
     '{"nome":"Giulia","cognome":"Colombo","categoria":"F","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000202'::uuid, 'sara.ricci@blvs.test',
     '{"nome":"Sara","cognome":"Ricci","categoria":"F","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000203'::uuid, 'chiara.marino@blvs.test',
     '{"nome":"Chiara","cognome":"Marino","categoria":"F","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb),
    ('00000000-0000-4000-8000-000000000204'::uuid, 'elena.greco@blvs.test',
     '{"nome":"Elena","cognome":"Greco","categoria":"F","consenso_privacy":"1.0","consenso_privacy_data":"2026-10-27"}'::jsonb)
),
nuovi as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
    email, extensions.crypt('Demo-BLVS-2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, meta, now(), now(),
    '', '', '', ''
  from account
  returning id, email
)
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), id, id::text, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from nuovi;

update public.utenti
set ruolo = 'admin'
where id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------------------------
-- Tappe (i tabelloni M/F li crea il trigger)
-- ---------------------------------------------------------------------------

insert into public.tappe (
  id, nome, luogo, data_inizio, data_fine, stato,
  iscrizioni_aprono_il, iscrizioni_chiudono_il
) values
  ('00000000-0000-4000-8000-000000001001', 'Tappa 1 · Jesolo',
   'Jesolo Lido, Piazza Mazzini', '2027-06-12', '2027-06-13', 'in_corso',
   '2027-05-01 09:00+02', '2027-06-05 23:59+02'),
  ('00000000-0000-4000-8000-000000001002', 'Tappa 2 · Rimini',
   'Rimini, Bagno 26', '2027-06-26', '2027-06-27', 'iscrizioni_aperte',
   '2027-05-15 09:00+02', '2027-06-19 23:59+02'),
  ('00000000-0000-4000-8000-000000001003', 'Tappa 3 · Cagliari',
   'Cagliari, Poetto', '2027-07-10', '2027-07-11', 'iscrizioni_chiuse',
   '2027-05-20 09:00+02', '2027-07-03 23:59+02');

-- ---------------------------------------------------------------------------
-- Iscrizioni
-- ---------------------------------------------------------------------------

insert into public.iscrizioni (tappa_id, tabellone_id, utente_id, stato)
select t.id, tb.id, u.id,
  case when t.stato = 'in_corso' then 'confermata' else 'in_attesa' end::public.stato_iscrizione
from public.tappe t
join public.utenti u on u.ruolo = 'giocatore'
join public.tabelloni tb on tb.tappa_id = t.id and tb.categoria = u.categoria
where t.id in (
  '00000000-0000-4000-8000-000000001001',
  '00000000-0000-4000-8000-000000001002'
);

-- ---------------------------------------------------------------------------
-- Jesolo, tabellone M: un girone e la prima partita (2 contro 2)
-- ---------------------------------------------------------------------------

insert into public.gironi (id, tabellone_id, nome)
select '00000000-0000-4000-8000-000000002001', tb.id, 'Girone A'
from public.tabelloni tb
where tb.tappa_id = '00000000-0000-4000-8000-000000001001' and tb.categoria = 'M';

insert into public.girone_iscrizioni (girone_id, iscrizione_id)
select '00000000-0000-4000-8000-000000002001', i.id
from public.iscrizioni i
join public.tabelloni tb on tb.id = i.tabellone_id
where tb.tappa_id = '00000000-0000-4000-8000-000000001001' and tb.categoria = 'M';

insert into public.partite (id, tabellone_id, girone_id, turno, campo, programmata_il, stato)
select '00000000-0000-4000-8000-000000003001', g.tabellone_id, g.id, 1, 'Campo 1',
  '2027-06-12 10:00+02', 'in_corso'
from public.gironi g
where g.id = '00000000-0000-4000-8000-000000002001';

insert into public.partita_giocatori (partita_id, iscrizione_id, squadra)
select '00000000-0000-4000-8000-000000003001', i.id,
  case when i.utente_id in (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102'
  ) then 'A' else 'B' end
from public.girone_iscrizioni gi
join public.iscrizioni i on i.id = gi.iscrizione_id
where gi.girone_id = '00000000-0000-4000-8000-000000002001';

-- Il trigger ha creato il punteggio alla versione 1; il primo set lo porta a 2.
update public.punteggi
set sets = '[{"a":21,"b":18},{"a":12,"b":9}]'::jsonb, versione = versione + 1
where partita_id = '00000000-0000-4000-8000-000000003001';
