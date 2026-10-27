-- BLVS-37 · Nuovo tipo di evento del registro «punteggio_parziale».
--
-- In un file a sé: un valore aggiunto a un enum si può usare solo dopo il
-- commit, e la migrazione successiva (20261027400100) lo usa.

alter type public.tipo_evento_registro add value if not exists 'punteggio_parziale';
