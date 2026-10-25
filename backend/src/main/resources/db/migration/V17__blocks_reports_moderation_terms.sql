-- Trygghet i community: blokkering, rapportering, moderering, sperring og godkjente vilkår.

-- role: MODERATOR/ADMIN kan behandle rapporter. Settes manuelt i databasen (se docs/moderation.md).
-- suspended_at: sperret konto. Kan ikke logge inn, og innholdet er skjult for andre.
-- terms_*: hvilken versjon av vilkårene brukeren har godtatt, og når.
ALTER TABLE users
    ADD COLUMN role              text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'MODERATOR', 'ADMIN')),
    ADD COLUMN suspended_at      timestamptz,
    ADD COLUMN terms_version     text,
    ADD COLUMN terms_accepted_at timestamptz;

-- Blokkering virker begge veier: ingen av dem ser den andres profil, økter, kommentarer eller delte programmer.
CREATE TABLE blocks (
    blocker_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    blocked_id uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);

-- Rapporter. target_user_id er eieren av innholdet; snapshot er en kopi av teksten da den ble rapportert,
-- slik at moderatorer ser hva som ble rapportert selv om det endres eller slettes.
CREATE TABLE reports (
    id              uuid        PRIMARY KEY,
    reporter_id     uuid        REFERENCES users (id) ON DELETE SET NULL,
    target_type     text        NOT NULL CHECK (target_type IN ('USER', 'WORKOUT', 'COMMENT', 'PROGRAM', 'ROUTINE')),
    target_id       uuid        NOT NULL,
    target_user_id  uuid        REFERENCES users (id) ON DELETE CASCADE,
    reason          text        NOT NULL CHECK (reason IN ('SPAM', 'HARASSMENT', 'HATE', 'NUDITY', 'VIOLENCE', 'SELF_HARM',
                                                            'IMPERSONATION', 'MISINFORMATION', 'OTHER')),
    details         text        CHECK (length(details) <= 1000),
    snapshot        text,
    status          text        NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'DISMISSED')),
    action          text        CHECK (action IN ('DISMISS', 'REMOVE_CONTENT', 'SUSPEND_USER')),
    resolution_note text        CHECK (length(resolution_note) <= 1000),
    resolved_by     uuid        REFERENCES users (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz
);
-- Samme person kan bare ha én åpen rapport på samme innhold.
CREATE UNIQUE INDEX reports_open_uq ON reports (reporter_id, target_type, target_id) WHERE status = 'OPEN';
CREATE INDEX reports_status_idx ON reports (status, created_at);
CREATE INDEX reports_target_idx ON reports (target_type, target_id);
