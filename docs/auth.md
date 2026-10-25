# Innlogging

## Oversikt

```text
Telefon                                   Backend                                 Database
───────                                   ───────                                 ────────
«Fortsett med e-post»
  POST /api/auth/email/start {email}  →   lager 6-sifret kode (10 min)        →   email_login_codes (bare HMAC av koden)
                                          sender e-post (lokalt: Mailpit)
  POST /api/auth/email/verify         →   sjekker kode (maks 5 forsøk)
«Fortsett med Google»
  Google-SDK gir ID-token
  POST /api/auth/google {idToken}     →   sjekker signatur (Googles nøkler),
                                          utsteder, mottaker og utløp
                                          finn/opprett bruker                  →   users, user_identities
                                    ←    { accessToken, refreshToken, userId, newUser }
Lagrer refreshToken i nøkkelringen
(expo-secure-store). accessToken i minnet.
Alle API-kall: Authorization: Bearer <accessToken>
Ved 401: POST /api/auth/refresh       →   roterer: gammelt token brukt opp,    →   refresh_tokens
                                          nytt utstedt i samme «familie»
```

- **Tilgangstoken:** JWT signert med HS256 (`AUTH_JWT_SECRET`), gyldig i 15 minutter. `sub` er bruker-ID. `CurrentUser` leser den fra Spring Security.
- **Fornyelsestoken:** 32 tilfeldige byte, gyldig i 60 dager, kan brukes én gang. Bare SHA-256-hashen lagres. Brukes et allerede brukt token på nytt, trekkes hele innloggingsøkten tilbake, fordi det tyder på at tokenet er stjålet. Telefonen sørger derfor for at bare én fornyelse kjører om gangen.
- **E-postkode:** 6 sifre, 10 minutter, maks 5 feil forsøk per kode og maks 5 koder per adresse i timen (`app.auth.max-codes-per-hour`). Grensen er slått av lokalt i `application-local.yml` mens vi tester. Bare en HMAC av koden lagres.
- **Kobling av kontoer:** Logger du inn med Google og e-postadressen er bekreftet og allerede brukt med e-postinnlogging (eller omvendt), blir det samme konto.
- **Utvikling:** I `local`-profilen behandles forespørsler **uten** Authorization-header som utviklingsbrukeren (curl, Swagger, tester). Forespørsler med token kontrolleres alltid. `POST /api/auth/claim-dev-data` flytter utviklingsbrukerens data til kontoen du logger inn med, og finnes bare lokalt.
- **Utlogging:** `POST /api/auth/logout` trekker tilbake økten. Telefonen synker først, varsler om noe ikke er synket, og sletter så alle lokale data. Ved neste innlogging hentes alt fra serveren.
- **Slett konto:** `DELETE /api/me` sletter brukeren og alle data (fremmednøkler med `ON DELETE CASCADE`).

## Lokalt oppsett

1. `.env` i rotmappen må ha `AUTH_JWT_SECRET` (minst 32 tegn). Lag en med `openssl rand -base64 48`.
2. `docker compose up -d` starter også **Mailpit**. E-postene med innloggingskoder ser du på <http://localhost:8025>. Koden står også i backend-loggen i `local`-profilen.

## Google-innlogging (engangsoppsett)

Google-innlogging krever appens egen utviklerversjon. Den virker ikke i Expo Go. E-postinnlogging virker begge steder.

1. Gå til <https://console.cloud.google.com/>, lag et prosjekt («Treningsapp») og åpne **APIs & Services → OAuth consent screen**. Velg «External», fyll inn appnavn og e-post og legg deg selv til som testbruker.
2. **Credentials → Create credentials → OAuth client ID:**
   - Type **Web application**, navn «Treningsapp backend». Ingen redirect-URI trengs. Kopier klient-ID-en (`…apps.googleusercontent.com`).
   - Type **iOS**, bundle ID `no.sigurdmaeland.treningsapp`. Kopier klient-ID-en.
3. Rotmappens `.env`: `GOOGLE_CLIENT_IDS=<web-klient-ID>`
4. `mobile/.env`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-klient-ID>
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS-klient-ID>
   ```
5. Bygg utviklerversjonen: `cd mobile && npx expo run:ios`. Første gang tar dette flere minutter. Deretter starter du med `npx expo start` og åpner appen «Treningsapp» i simulatoren, ikke Expo Go.

Klient-ID-er er offentlige identifikatorer, ikke hemmeligheter. `AUTH_JWT_SECRET` er en hemmelighet og skal bare ligge i `.env` eller miljøvariabler på serveren.

## Senere

- **Apple-innlogging** krever Apple Developer Program. Tabellen `user_identities` støtter `APPLE` allerede.
- E-posttjeneste i drift (SMTP-innstillingene `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`).
- Fartsgrense per IP-adresse på innloggingsendepunktene.
