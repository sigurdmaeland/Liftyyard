-- Community: programmer og rutiner kan deles med følgere eller alle, og lastes ned (kopieres) av andre.

-- Programmer: ny synlighet FOLLOWERS (i tillegg til PRIVATE og PUBLIC).
ALTER TABLE programs DROP CONSTRAINT programs_visibility_check;
ALTER TABLE programs ADD CONSTRAINT programs_visibility_check CHECK (visibility IN ('PRIVATE', 'FOLLOWERS', 'PUBLIC'));
CREATE INDEX programs_shared_idx ON programs (owner_user_id, created_at DESC) WHERE visibility <> 'PRIVATE';

-- Rutiner: egen synlighet (gjelder frittstående rutiner; rutiner i et program følger programmet),
-- antall nedlastinger og hvilken rutine en nedlastet kopi kom fra.
ALTER TABLE routines
    ADD COLUMN visibility        text    NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'FOLLOWERS', 'PUBLIC')),
    ADD COLUMN download_count    integer NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    ADD COLUMN source_routine_id uuid;
CREATE INDEX routines_shared_idx ON routines (visibility, download_count DESC) WHERE visibility <> 'PRIVATE' AND program_id IS NULL;

-- Varsel når noen laster ned et program eller en rutine du har delt.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('FOLLOW', 'FOLLOW_REQUEST', 'FOLLOW_ACCEPTED', 'LIKE', 'COMMENT', 'DOWNLOAD'));
ALTER TABLE notifications
    ADD COLUMN program_id uuid REFERENCES programs (id) ON DELETE CASCADE,
    ADD COLUMN routine_id uuid REFERENCES routines (id) ON DELETE CASCADE;
