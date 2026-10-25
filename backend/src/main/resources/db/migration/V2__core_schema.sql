-- Kjerneskjema for fase 2: brukere, øvelsesbibliotek og gjennomførte økter.
-- Se docs/database-schema.md for begrunnelser.

-- Brukere. Ingen passordfelt: innlogging skjer via Apple/Google (user_identities, senere).
CREATE TABLE users (
    id           uuid        PRIMARY KEY,
    email        text        UNIQUE,
    display_name text        NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Øvelser. owner_user_id IS NULL = felles katalog, ellers brukerens egen øvelse.
CREATE TABLE exercises (
    id            uuid        PRIMARY KEY,
    owner_user_id uuid        REFERENCES users (id) ON DELETE CASCADE,
    name          text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    exercise_type text        NOT NULL CHECK (exercise_type IN (
                                  'WEIGHT_REPS', 'BODYWEIGHT_REPS', 'WEIGHTED_BODYWEIGHT',
                                  'ASSISTED_BODYWEIGHT', 'DURATION', 'DISTANCE_DURATION')),
    equipment     text        NOT NULL CHECK (equipment IN (
                                  'BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL',
                                  'BAND', 'SMITH_MACHINE', 'EZ_BAR', 'OTHER')),
    instructions  text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    archived_at   timestamptz
);

CREATE UNIQUE INDEX exercises_catalog_name_uq ON exercises (lower(name)) WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX exercises_custom_name_uq ON exercises (owner_user_id, lower(name)) WHERE owner_user_id IS NOT NULL;

CREATE TABLE exercise_muscles (
    exercise_id uuid NOT NULL REFERENCES exercises (id) ON DELETE CASCADE,
    muscle      text NOT NULL CHECK (muscle IN (
                    'CHEST', 'LATS', 'UPPER_BACK', 'LOWER_BACK', 'TRAPS', 'SHOULDERS', 'BICEPS', 'TRICEPS',
                    'FOREARMS', 'ABS', 'OBLIQUES', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS',
                    'ABDUCTORS')),
    role        text NOT NULL CHECK (role IN ('PRIMARY', 'SECONDARY')),
    PRIMARY KEY (exercise_id, muscle)
);

-- Gjennomførte økter. ID-ene lages av appen (UUIDv7) slik at nye forsøk etter
-- nettverksbrudd aldri gir duplikater (PUT /api/workouts/{id} er idempotent).
CREATE TABLE workouts (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text        NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    notes      text,
    started_at timestamptz NOT NULL,
    ended_at   timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ended_at >= started_at)
);

CREATE INDEX workouts_user_started_idx ON workouts (user_id, started_at DESC);

-- Øvelser i en økt. exercise_name og exercise_type er et øyeblikksbilde: senere
-- endringer i øvelsen eller en rutine skal ikke endre historikken.
CREATE TABLE workout_exercises (
    id            uuid    PRIMARY KEY,
    workout_id    uuid    NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    position      integer NOT NULL CHECK (position >= 0),
    exercise_id   uuid    REFERENCES exercises (id) ON DELETE SET NULL,
    exercise_name text    NOT NULL,
    exercise_type text    NOT NULL,
    notes         text,
    UNIQUE (workout_id, position)
);

CREATE INDEX workout_exercises_exercise_idx ON workout_exercises (exercise_id);

-- Sett. Vekt lagres alltid i kg. Visningsenhet er en brukerinnstilling.
CREATE TABLE workout_sets (
    id                  uuid         PRIMARY KEY,
    workout_exercise_id uuid         NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
    position            integer      NOT NULL CHECK (position >= 0),
    set_type            text         NOT NULL DEFAULT 'NORMAL'
                                     CHECK (set_type IN ('NORMAL', 'WARMUP', 'FAILURE', 'DROP')),
    weight_kg           numeric(7,2) CHECK (weight_kg >= 0),
    reps                integer      CHECK (reps >= 0),
    rpe                 numeric(3,1) CHECK (rpe BETWEEN 1 AND 10),
    duration_seconds    integer      CHECK (duration_seconds >= 0),
    distance_m          numeric(9,2) CHECK (distance_m >= 0),
    completed_at        timestamptz,
    UNIQUE (workout_exercise_id, position)
);
