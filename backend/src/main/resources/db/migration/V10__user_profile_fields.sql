-- Profilfelter brukeren selv redigerer. display_name beholdes og settes fra for- og etternavn.
ALTER TABLE users
    ADD COLUMN first_name text CHECK (length(first_name) <= 50),
    ADD COLUMN last_name  text CHECK (length(last_name) <= 50),
    ADD COLUMN bio        text CHECK (length(bio) <= 300),
    ADD COLUMN birth_date date,
    ADD COLUMN gender     text CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    ADD COLUMN instagram  text CHECK (length(instagram) <= 30),
    ADD COLUMN tiktok     text CHECK (length(tiktok) <= 30),
    ADD COLUMN youtube    text CHECK (length(youtube) <= 100),
    ADD COLUMN website    text CHECK (length(website) <= 200);
