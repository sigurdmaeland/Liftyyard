-- Følging. Følger man en privat profil, er følgingen PENDING til eieren godtar den.
CREATE TABLE follows (
    follower_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followee_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status      text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX follows_followee_idx ON follows (followee_id, status);

-- Søk på navn (brukernavn har allerede unik indeks).
CREATE INDEX users_display_name_idx ON users (lower(display_name));
