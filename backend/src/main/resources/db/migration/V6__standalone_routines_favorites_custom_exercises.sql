-- Rutiner blir selvstendige: de kan ligge i et program eller stå alene (program_id NULL),
-- og lagres/synkes hver for seg. Favoritter for rutiner og øvelser.

ALTER TABLE routines ADD COLUMN owner_user_id uuid REFERENCES users (id) ON DELETE CASCADE;
UPDATE routines r SET owner_user_id = p.owner_user_id FROM programs p WHERE p.id = r.program_id;
ALTER TABLE routines ALTER COLUMN owner_user_id SET NOT NULL;
ALTER TABLE routines ALTER COLUMN program_id DROP NOT NULL;
ALTER TABLE routines
    ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- Rekkefølgen i et program er bare sortering; rutiner lagres enkeltvis, så unik posisjon
-- ville gjort det umulig å bytte plass på to rutiner med to separate forespørsler.
ALTER TABLE routines DROP CONSTRAINT routines_program_id_position_key;
CREATE INDEX routines_owner_idx ON routines (owner_user_id, updated_at DESC);
CREATE INDEX routines_program_idx ON routines (program_id, position);

CREATE TABLE routine_favorites (
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    routine_id uuid        NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, routine_id)
);

CREATE TABLE exercise_favorites (
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    exercise_id uuid        NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, exercise_id)
);
