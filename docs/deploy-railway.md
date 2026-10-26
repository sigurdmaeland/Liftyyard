# Drift: backend på Railway, bilder i Cloudflare R2

Backend (Spring Boot) og PostgreSQL kjører på [Railway](https://railway.com) i regionen **EU West (Amsterdam)**.
Bildene ligger i [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/). Alt ligger i EU.

Railway bygger `backend/Dockerfile` og ruller ut automatisk når `main` på GitHub endres.
Innstillingene for bygging og helsesjekk ligger i `backend/railway.json`.

## 1. Railway-prosjekt

1. Logg inn på railway.com med GitHub. **New Project → Deploy from GitHub repo →** velg repoet.
2. Åpne tjenesten som ble laget, og under **Settings**:
   - **Root Directory:** `/backend`
   - **Config-as-code / Railway Config File:** `/backend/railway.json` (hvis den ikke oppdages selv)
   - **Region:** EU West (Amsterdam)
   - **Wait for CI:** på, så det bare rulles ut når GitHub Actions er grønn
3. **+ New → Database → PostgreSQL.** Sett regionen til EU West her også.
4. Under backend-tjenesten → **Networking → Generate Domain** (eller koble til `api.liftyard.app` senere).

## 2. Miljøvariabler for backend-tjenesten

Legg inn under **Variables**. `${{Postgres.…}}` er Railways referanser til databasen og fylles ut av Railway selv.

| Variabel | Verdi |
|---|---|
| `POSTGRES_HOST` | `${{Postgres.PGHOST}}` |
| `POSTGRES_PORT` | `${{Postgres.PGPORT}}` |
| `POSTGRES_DB` | `${{Postgres.PGDATABASE}}` |
| `POSTGRES_USER` | `${{Postgres.PGUSER}}` |
| `POSTGRES_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
| `AUTH_JWT_SECRET` | Lang tilfeldig verdi: `openssl rand -base64 48` (ny, ikke den lokale) |
| `GOOGLE_CLIENT_IDS` | Web-klient-ID-en fra Google Cloud (tom = Google-innlogging av) |
| `MEDIA_STORAGE` | `s3` |
| `MEDIA_PUBLIC_URL` | R2-bøttens offentlige adresse, f.eks. `https://media.liftyard.app` |
| `S3_ENDPOINT` | `https://<konto-ID>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `liftyard-media` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Fra R2-API-tokenet (steg 3) |
| `MAIL_HOST` / `MAIL_PORT` | SMTP fra e-posttjenesten (steg 4), port 587 |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Fra e-posttjenesten |
| `MAIL_SMTP_AUTH` / `MAIL_STARTTLS` | `true` / `true` |
| `MAIL_FROM` | `Liftyard <no-reply@liftyard.app>` |

Railway setter `PORT` selv. Hemmelighetene ligger bare i Railway, aldri i repoet eller i appen.

## 3. Cloudflare R2 (bilder)

1. Cloudflare → **R2 → Create bucket:** `liftyard-media`, plassering **EU** (jurisdiksjon EU).
2. Bøtta → **Settings → Public access:** koble til et eget domene, f.eks. `media.liftyard.app`
   (krever at domenet ligger hos Cloudflare). Til testing går den midlertidige `r2.dev`-adressen.
3. **R2 → Manage API tokens → Create token:** «Object Read & Write», bare for denne bøtta.
   Kopier Access Key ID, Secret Access Key og endepunktet (`https://<konto-ID>.r2.cloudflarestorage.com`).

Bildeadressene inneholder tilfeldige ID-er, slik som lokalt. Backend skalerer og fjerner metadata (som GPS)
før lagring, akkurat som før.

## 4. E-post (innloggingskoder)

Innlogging med e-postkode krever en e-posttjeneste med SMTP, f.eks. Resend, Postmark eller Brevo.
Verifiser domenet (`liftyard.app`) hos tjenesten, så kodene ikke havner i søppelpost.

## 5. Appen

Sett adressen fra steg 1.4 i `mobile/.env`:

```
EXPO_PUBLIC_API_URL=https://<din-adresse>.up.railway.app
```

Start appen på nytt (`npx expo start` eller bygg på nytt). Appen snakker nå med serveren på nett.

## Sjekk at det virker

- `https://<adresse>/actuator/health` svarer `{"status":"UP"}`.
- Railway → **Deployments → View logs** viser at Flyway har kjørt migreringene.
- Logg inn i appen, last opp et profilbilde og se at det dukker opp i R2-bøtta.

## Backup

Railway tar daglige sikkerhetskopier av databasevolumet på betalte planer (se **Postgres → Backups**).
Sett det opp før ekte brukere slipper til.
