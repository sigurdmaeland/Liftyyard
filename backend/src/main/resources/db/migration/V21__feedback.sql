-- Tilbakemeldinger fra «Få hjelp» i appen: feil, forslag og spørsmål til support.
-- Slettes sammen med kontoen. Moderatorer leser og lukker dem.
CREATE TABLE feedback (
    id          uuid        PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    kind        text        NOT NULL CHECK (kind IN ('BUG', 'IDEA', 'SUPPORT')),
    message     text        NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
    app_version text,
    platform    text,
    status      text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    done_at     timestamptz
);
CREATE INDEX feedback_status_created_idx ON feedback (status, created_at DESC);
CREATE INDEX feedback_user_created_idx ON feedback (user_id, created_at DESC);
