-- BLVS-22 · Nuovo stato «archiviata» della tappa.
--
-- In un file a sé: un valore aggiunto a un enum si può usare solo dopo il
-- commit, e la migrazione successiva (20261027324100) lo usa.

alter type public.stato_tappa add value if not exists 'archiviata';
