-- Offentlig profil: unikt brukernavn (lagres med små bokstaver), synlighet og profilbilde i objektlagringen.
ALTER TABLE users
    ADD COLUMN username   text CHECK (username ~ '^[a-z0-9._]{3,30}$'),
    ADD COLUMN visibility text NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
    ADD COLUMN avatar_key text;

CREATE UNIQUE INDEX users_username_idx ON users (username);
