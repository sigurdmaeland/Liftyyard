-- Synlighet per økt: PUBLIC (alle som kan se profilen), FOLLOWERS (godtatte følgere, standard) eller PRIVATE (bare meg).
ALTER TABLE workouts
    ADD COLUMN visibility text NOT NULL DEFAULT 'FOLLOWERS' CHECK (visibility IN ('PUBLIC', 'FOLLOWERS', 'PRIVATE'));
CREATE INDEX workouts_feed_idx ON workouts (user_id, started_at DESC);

-- Liker: én per bruker og økt.
CREATE TABLE workout_likes (
    workout_id uuid        NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workout_id, user_id)
);

CREATE TABLE workout_comments (
    id         uuid        PRIMARY KEY,
    workout_id uuid        NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       text        NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_comments_workout_idx ON workout_comments (workout_id, created_at);

-- Bilder på økter (maks 4, sjekkes i koden). storage_key peker inn i bildelagringen.
CREATE TABLE workout_photos (
    id          uuid        PRIMARY KEY,
    workout_id  uuid        NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    storage_key text        NOT NULL,
    position    integer     NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_photos_workout_idx ON workout_photos (workout_id, position);

-- Varsler: ny følger, følgeforespørsel, godtatt forespørsel, liker og kommentar.
CREATE TABLE notifications (
    id           uuid        PRIMARY KEY,
    recipient_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    actor_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type         text        NOT NULL CHECK (type IN ('FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED', 'LIKE', 'COMMENT')),
    workout_id   uuid        REFERENCES workouts (id) ON DELETE CASCADE,
    comment_id   uuid        REFERENCES workout_comments (id) ON DELETE CASCADE,
    created_at   timestamptz NOT NULL DEFAULT now(),
    read_at      timestamptz
);
CREATE INDEX notifications_recipient_idx ON notifications (recipient_id, created_at DESC);
