-- Kreditering: kopier av delte programmer og rutiner husker hvem som laget originalen.
-- Feltene peker alltid til første opphav (ikke mellomledd), og navnene lagres som øyeblikksbilde
-- slik at kreditten står igjen selv om originalen eller kontoen slettes.
ALTER TABLE programs
    ADD COLUMN origin_program_id  uuid,
    ADD COLUMN origin_user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN origin_author_name text,
    ADD COLUMN origin_name        text;
CREATE INDEX programs_origin_idx ON programs (origin_program_id) WHERE origin_program_id IS NOT NULL;

ALTER TABLE routines
    ADD COLUMN origin_routine_id  uuid,
    ADD COLUMN origin_user_id     uuid REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN origin_author_name text,
    ADD COLUMN origin_name        text;
CREATE INDEX routines_origin_idx ON routines (origin_routine_id) WHERE origin_routine_id IS NOT NULL;

-- Eksisterende kopier får kreditt fra originalen de ble lastet ned fra.
UPDATE programs c SET origin_program_id = s.id, origin_user_id = s.owner_user_id, origin_author_name = u.display_name, origin_name = s.name
FROM programs s JOIN users u ON u.id = s.owner_user_id
WHERE c.source_program_id = s.id;

UPDATE routines c SET origin_routine_id = s.id, origin_user_id = s.owner_user_id, origin_author_name = u.display_name, origin_name = s.name
FROM routines s JOIN users u ON u.id = s.owner_user_id
WHERE c.source_routine_id = s.id;
