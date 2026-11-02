-- Tappa King & Queen mista · 1/2: la categoria del tabellone misto.
--
-- `X` è la categoria del solo tabellone di una tappa mista: ci giocano
-- uomini e donne insieme. Non è mai la categoria di un giocatore (lo
-- impone `utenti_categoria_giocatore` nella migrazione successiva).
--
-- Migrazione a sé: un valore nuovo di un enum si può usare solo dopo il
-- commit della transazione che lo aggiunge.

alter type public.categoria add value if not exists 'X';
