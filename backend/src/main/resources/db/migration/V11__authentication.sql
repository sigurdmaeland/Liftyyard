-- Innlogging: koblinger til innloggingsmetoder, engangskoder på e-post og fornyelsestokens.

-- En bruker kan ha flere innloggingsmetoder (Google, e-post, senere Apple).
-- subject er leverandørens stabile ID (Google «sub») eller normalisert e-postadresse.
CREATE TABLE user_identities (
    provider   text        NOT NULL CHECK (provider IN ('GOOGLE', 'EMAIL', 'APPLE')),
    subject    text        NOT NULL,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email      text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject)
);
CREATE INDEX user_identities_user_idx ON user_identities (user_id);
CREATE INDEX user_identities_email_idx ON user_identities (lower(email));

-- Engangskoder for «Fortsett med e-post». Bare en hash av koden lagres.
CREATE TABLE email_login_codes (
    id          uuid        PRIMARY KEY,
    email       text        NOT NULL,
    code_hash   text        NOT NULL,
    expires_at  timestamptz NOT NULL,
    attempts    integer     NOT NULL DEFAULT 0,
    consumed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_login_codes_email_idx ON email_login_codes (email, created_at DESC);

-- Fornyelsestokens roteres ved hver bruk. family_id samler en innloggingsøkt, slik at gjenbruk av
-- et gammelt token (tegn på tyveri) kan trekke tilbake hele økten.
CREATE TABLE refresh_tokens (
    id         uuid        PRIMARY KEY,
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    family_id  uuid        NOT NULL,
    token_hash text        NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
