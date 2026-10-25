-- Supersett, svar og liker på kommentarer, treningspartnere og nye varseltyper.

-- Øvelser med samme gruppenummer i en økt er et supersett (gjøres etter hverandre).
ALTER TABLE workout_exercises ADD COLUMN superset_group smallint CHECK (superset_group BETWEEN 1 AND 50);

-- Svar på kommentarer (ett nivå: svar på et svar henges på den øverste kommentaren).
ALTER TABLE workout_comments ADD COLUMN parent_id uuid REFERENCES workout_comments (id) ON DELETE CASCADE;
CREATE INDEX workout_comments_parent_idx ON workout_comments (parent_id) WHERE parent_id IS NOT NULL;

CREATE TABLE comment_likes (
    comment_id uuid        NOT NULL REFERENCES workout_comments (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (comment_id, user_id)
);

-- Hvem eieren trente sammen med («Trente med»).
CREATE TABLE workout_partners (
    workout_id uuid        NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workout_id, user_id)
);
CREATE INDEX workout_partners_user_idx ON workout_partners (user_id);

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED', 'LIKE', 'COMMENT', 'DOWNLOAD',
                    'COMMENT_LIKE', 'REPLY', 'TAG', 'MENTION'));

-- Ukesmål (antall økter per uke) og foretrukket vektenhet. Vekter lagres alltid i kg.
ALTER TABLE user_settings
    ADD COLUMN weekly_goal smallint CHECK (weekly_goal BETWEEN 1 AND 14),
    ADD COLUMN weight_unit text NOT NULL DEFAULT 'KG' CHECK (weight_unit IN ('KG', 'LB'));
