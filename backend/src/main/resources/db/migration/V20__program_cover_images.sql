-- Forsidebilde på programmer. Nøkkelen peker til bildet i bildelagringen (covers/<program>/<id>.jpg).
ALTER TABLE programs ADD COLUMN cover_key text;
