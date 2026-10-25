-- Kroppsmålinger (vekt, kroppsfett, høyde, omkrets) og brukerinnstillinger (vektmål).
-- Enheter er faste per type: WEIGHT i kg, BODY_FAT i prosent, alt annet i cm.
CREATE TABLE body_measurements (
    id          uuid         PRIMARY KEY,
    user_id     uuid         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        text         NOT NULL CHECK (kind IN (
                                 'WEIGHT', 'BODY_FAT', 'HEIGHT', 'NECK', 'SHOULDERS', 'CHEST', 'WAIST', 'HIPS',
                                 'LEFT_ARM', 'RIGHT_ARM', 'LEFT_FOREARM', 'RIGHT_FOREARM',
                                 'LEFT_THIGH', 'RIGHT_THIGH', 'LEFT_CALF', 'RIGHT_CALF')),
    value       numeric(7,2) NOT NULL CHECK (value > 0),
    measured_at timestamptz  NOT NULL,
    created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX body_measurements_user_kind_idx ON body_measurements (user_id, kind, measured_at DESC);

CREATE TABLE user_settings (
    user_id        uuid         PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    goal_weight_kg numeric(6,2) CHECK (goal_weight_kg > 0),
    updated_at     timestamptz  NOT NULL DEFAULT now()
);
