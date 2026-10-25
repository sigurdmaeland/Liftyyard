-- Utforsk: offentlige programmer som kan lastes ned (kopieres) til eget bibliotek.
ALTER TABLE programs
    ADD COLUMN level             text    CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    ADD COLUMN days_per_week     integer CHECK (days_per_week BETWEEN 1 AND 7),
    ADD COLUMN download_count    integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    -- Settes på kopier: hvilket offentlig program kopien ble lastet ned fra.
    ADD COLUMN source_program_id uuid;

CREATE INDEX programs_public_idx ON programs (visibility, download_count DESC) WHERE visibility = 'PUBLIC';

-- Systemkonto som eier appens egne programmer (ikke en innloggbar bruker).
INSERT INTO users (id, display_name) VALUES ('00000000-0000-7000-8000-0000000000aa', 'Treningsapp');
