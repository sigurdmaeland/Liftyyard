-- Treningsprogrammer: et program har rutiner (treningsdager), som har øvelser med målsett.
-- Når en rutine startes, kopieres den inn i en økt (workouts). Senere endringer i rutinen
-- påvirker derfor aldri gjennomførte økter.

CREATE TABLE programs (
    id            uuid        PRIMARY KEY,
    owner_user_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    description   text        CHECK (length(description) <= 2000),
    -- Forberedt for community: PUBLIC-programmer kan senere vises i Utforsk.
    visibility    text        NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX programs_owner_idx ON programs (owner_user_id, updated_at DESC);

CREATE TABLE routines (
    id         uuid    PRIMARY KEY,
    program_id uuid    NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
    position   integer NOT NULL CHECK (position >= 0),
    name       text    NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    notes      text,
    UNIQUE (program_id, position)
);

CREATE TABLE routine_exercises (
    id            uuid    PRIMARY KEY,
    routine_id    uuid    NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    position      integer NOT NULL CHECK (position >= 0),
    exercise_id   uuid    REFERENCES exercises (id) ON DELETE SET NULL,
    exercise_name text    NOT NULL,
    exercise_type text    NOT NULL,
    notes         text,
    rest_seconds  integer CHECK (rest_seconds BETWEEN 0 AND 3600),
    UNIQUE (routine_id, position)
);

CREATE INDEX routine_exercises_exercise_idx ON routine_exercises (exercise_id);

CREATE TABLE routine_sets (
    id                      uuid         PRIMARY KEY,
    routine_exercise_id     uuid         NOT NULL REFERENCES routine_exercises (id) ON DELETE CASCADE,
    position                integer      NOT NULL CHECK (position >= 0),
    set_type                text         NOT NULL DEFAULT 'NORMAL'
                                         CHECK (set_type IN ('NORMAL', 'WARMUP', 'FAILURE', 'DROP')),
    target_reps             integer      CHECK (target_reps BETWEEN 0 AND 1000),
    target_weight_kg        numeric(7,2) CHECK (target_weight_kg >= 0),
    target_duration_seconds integer      CHECK (target_duration_seconds BETWEEN 0 AND 86400),
    UNIQUE (routine_exercise_id, position)
);

-- Hvilken rutine en økt ble startet fra (ingen FK: økten skal bestå selv om rutinen slettes).
ALTER TABLE workouts ADD COLUMN source_routine_id uuid;
