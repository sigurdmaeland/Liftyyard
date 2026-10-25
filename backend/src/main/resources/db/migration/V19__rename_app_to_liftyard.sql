-- Appen heter nå Liftyard. Systembrukeren som eier de ferdige programmene får nytt visningsnavn,
-- og kreditteringen på kopier av disse programmene og rutinene oppdateres tilsvarende.
UPDATE users SET display_name = 'Liftyard' WHERE id = '00000000-0000-7000-8000-0000000000aa';
UPDATE programs SET origin_author_name = 'Liftyard' WHERE origin_user_id = '00000000-0000-7000-8000-0000000000aa';
UPDATE routines SET origin_author_name = 'Liftyard' WHERE origin_user_id = '00000000-0000-7000-8000-0000000000aa';
