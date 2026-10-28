-- BLVS-51 · Nuovo tipo di evento del registro «annullamento_iscrizione».
--
-- In un file a sé: un valore aggiunto a un enum si può usare solo dopo il
-- commit, e la migrazione successiva (20261027510100) lo usa.

alter type public.tipo_evento_registro add value if not exists 'annullamento_iscrizione';
