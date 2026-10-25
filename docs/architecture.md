# Arkitektur

Status: fase 1 (prosjektgrunnlag). Dokumentet oppdateres når arkitekturen endres.

## Oversikt

```text
┌──────────────────────────────┐        HTTPS / JSON        ┌───────────────────────────┐
│  Mobilapp (iOS / Android)    │  ───────────────────────▶  │  Backend (Spring Boot)    │
│  Expo + React Native + TS    │                            │  Modulær monolitt, REST   │
│  SQLite lokalt (offline)     │  ◀───────────────────────  │  OpenAPI-dokumentert      │
└──────────────────────────────┘                            └─────────────┬─────────────┘
                                                                          │ JDBC / Flyway
                                                             ┌────────────▼────────────┐
                                                             │  PostgreSQL 18           │
                                                             └─────────────────────────┘
                                                             (Objektlagring for media: senere)
```

## Valgte versjoner (oktober 2026)

| Del | Versjon | Begrunnelse |
|---|---|---|
| Expo SDK | 58 | Nyeste stabile, utgitt 29.09.2026 |
| React Native | 0.88 | Låst av Expo SDK 58 |
| React | 19.3 | Låst av Expo SDK 58 |
| TypeScript | 6.0 | Fra Expo-malen, `strict` på |
| Node.js | 22.13+ (du har 22.14) | Minimumskrav for Expo SDK 58 |
| Java | 21 (LTS) | Allerede installert, og støttet av Spring Boot 4 |
| Spring Boot | 4.1.1 | Nyeste stabile. 4.1 har gratis støtte til 31.07.2027 |
| Gradle | 9.x (wrapper) | Byggeverktøyet. Valgt i stedet for Maven fordi oppsettet er kortere og Kotlin-DSL gir typesjekk i VS Code |
| springdoc-openapi | 3.1.1 | OpenAPI og Swagger UI for Spring Boot 4 |
| PostgreSQL | 18 (Docker) | Nyeste hovedversjon |
| Flyway | styrt av Spring Boot | Versjonerte migreringer |

Versjonene til Spring-avhengighetene styres av Spring Boot sin BOM, slik at de alltid passer sammen.

## Mobilapp (`mobile/`)

- **Expo Router** for navigasjon. Hver fil i `src/app/` er en skjerm.
- `src/features/<område>/` inneholder skjermlogikk og komponenter per funksjon (workout, history, ...).
- `src/components/` inneholder gjenbrukbare UI-komponenter.
- `src/theme/` er den eneste kilden til farger, typografi, avstand og radius.
- `src/services/` inneholder API-klienten. Adressen kommer fra `EXPO_PUBLIC_API_URL`, som er offentlig og ikke skal inneholde hemmeligheter.
- Under utvikling kjøres appen i **Expo Go** i iOS Simulator. Når vi trenger native moduler som Expo Go ikke har, går vi over til en *development build* (`npx expo run:ios`). Det er en ren overgang, ikke et stack-bytte.

Lokal lagring og synkronisering (fase 2):

- **`expo-sqlite`** er sannhetskilden på telefonen. Skjemaet (`src/storage/database.ts`) migreres med `PRAGMA user_version`. Aktiv økt og hvert sett skrives til SQLite med en gang.
- **Synkronisering** (`src/services/sync.ts`): Fullførte økter får `sync_status = pending` og lastes opp med `PUT /api/workouts/{id}` ved oppstart, når appen kommer i forgrunnen, når forsiden vises og rett etter fullføring. Ved nettverksfeil eller 5xx prøver appen igjen senere. Ved 4xx settes `failed` med feilmelding, slik at brukeren kan prøve på nytt manuelt.
- **Øvelseskatalogen** hentes fra serveren og lagres lokalt, slik at søk fungerer offline.
- **ID-er** lages lokalt som UUIDv7 (`src/lib/ids.ts`).
- Vi bruker ingen egne biblioteker for tilstand og serverdata ennå. SQLite og en liten `useLocalQuery`-hook dekker behovet. TanStack Query eller Zustand vurderes hvis kompleksiteten øker.
- **Enhetstester** for ren logikk ligger i `mobile/tests` (Jest via `jest-expo`).
- **Ikke med ennå:** henting av historikk fra serveren (for eksempel ved ny telefon), redigering av fullførte økter, RPE i grensesnittet, hviletimer og supersett.

## Backend (`backend/`)

Én pakke per domenemodul under `no.fitnessapp`:

```text
no.fitnessapp
├── health        (finnes)  helsesjekk
├── auth          (fase 2+) registrering, innlogging, tokens
├── users         (fase 2+) profil og innstillinger
├── exercises     (fase 2)  øvelsesbibliotek
├── routines      (fase 3)  rutiner og maler
├── workouts      (fase 2)  gjennomførte økter, sett og grupper
└── progress      (fase 3)  PR, volum og statistikk
```

Hver modul deles i lag: `api` (controllere og DTO-er med Bean Validation) → `application` (tjenester og transaksjoner) → `domain` (forretningsregler) → `infrastructure` (repositories og JPA). Databaseentiteter eksponeres aldri direkte i API-et.

- **Feilsvar:** RFC 9457 Problem Details (`application/problem+json`), slått på i `application.yml`.
- **Skjema:** eies av Flyway (`src/main/resources/db/migration`). Hibernate kjører med `ddl-auto: validate` og endrer aldri tabeller.
- **Hemmeligheter:** kommer fra miljøvariabler. Lokalt hentes de fra rotfilen `.env`, som ikke sjekkes inn.
- **API-dokumentasjon:** `/swagger-ui.html` og `/v3/api-docs`.
- **Drift:** Actuator på `/actuator/health`, med liveness- og readiness-prober.
- **Tester:** integrasjonstester mot ekte PostgreSQL via Testcontainers. Det krever at Docker kjører.

## Prinsipper som må være på plass før treningsloggingen bygges

1. **Øyeblikksbilde av økter.** En fullført økt kopierer øvelsesnavn, mål og settdata inn i `workout_*`-tabellene. Den peker ikke bare til rutinen, så senere endringer i en rutine endrer aldri historikken.
2. **Klientgenererte UUID-er.** Appen lager ID-en (UUIDv7) for økter og sett. API-et bruker `PUT /workouts/{id}`, så et nytt forsøk etter nettverksbrudd gir ikke duplikater.
3. **Lokal først.** Hvert registrert sett skrives straks til SQLite med en `sync_status` (`pending`, `synced`, `failed`). Synkronisering skjer i bakgrunnen.
4. **Konflikter:** I starten gjelder at siste skriving vinner per økt, med `updated_at` og versjonsnummer. Strategien dokumenteres før synkronisering bygges.
5. **Tid og enheter:** Alle tidsstempler lagres i UTC (`timestamptz`). Vekt lagres alltid i kilogram (`numeric`), og visningsenheten er en brukerinnstilling.

## Utviklingsplan

| Fase | Innhold | Ferdig når |
|---|---|---|
| 1 Grunnlag | Expo-app, Spring Boot, PostgreSQL og Flyway, helsesjekk, dokumentasjon | Appen viser «Backend: UP» i simulatoren |
| 2 Vertikal flyt | Datamodell for øvelser og økter, lokal SQLite, finn øvelse → start økt → registrer sett → fullfør → lagre til server → se historikk | Hele flyten fungerer, også offline, med tester |
| 3 Rutiner og historikk | Rutiner, start fra rutine, forrige vekter, PR og statistikk | |
| 4 Bibliotek og polering | Søk og filtre, media med avklart lisens, hviletimer, settvarianter, tilgjengelighet | |
| 5 Produktmodning | Konto, sletting og eksport, abonnement, sosialt, integrasjoner, publisering | |
| 6 AI | Coach, programgenerering og progresjonsanalyse | |

## Innlogging (planlagt)

- **Logg på med Apple og Google.** Appen får et signert ID-token fra Apple eller Google. Backend verifiserer signatur, utsteder (aud) og utløp, og utsteder så sine egne tokens: et kortlivet access-token og et refresh-token.
- Apple krever at apper som tilbyr Google-innlogging også tilbyr *Logg på med Apple* eller et tilsvarende personvernvennlig alternativ (App Store Review Guidelines 4.8). Begge skal derfor med.
- Datamodell: `users` har ikke noe passord, og innloggingsmetodene ligger i `user_identities`.
- **Frem til da:** I `local`-profilen brukes én utviklingsbruker (`app.dev-user`). Alle brukeravhengige endepunkter går via `CurrentUser`. Uten innlogging og uten dev-bruker svarer API-et 401, og det dekkes av en test.

Se også [database-schema.md](database-schema.md).
