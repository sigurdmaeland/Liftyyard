# Liftyard

Sosial styrketreningsapp for iOS og Android. Prosjektet ligger i `~/Developer/fitness-app`, utenfor iCloud-synkronisert Skrivebord. Repoet inneholder mobilappen (`mobile/`), backend (`backend/`) og dokumentasjon (`docs/`). Se [docs/architecture.md](docs/architecture.md) for arkitektur, versjoner og plan.

## Forutsetninger (macOS)

| Verktøy | Versjon | Installasjon |
|---|---|---|
| Node.js | 22.13 eller nyere | `brew install node@22` eller nodejs.org |
| Java JDK | 21 | `brew install openjdk@21` (Gradle kan også laste den ned automatisk) |
| Gradle | 9.x | `brew install gradle`. Trengs bare én gang for å lage `gradlew` |
| Xcode | nyeste | App Store, deretter `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| iOS Simulator | | `xcodebuild -downloadPlatform iOS` |
| Docker Desktop | | docker.com, må kjøre når du utvikler |
| Android Studio | | Valgfritt, for Android Emulator |

## Første gangs oppsett

```bash
cd ~/Developer/fitness-app

# 1. Lokal konfigurasjon (database-passord osv.)
cp -n .env.example .env
cp -n mobile/.env.example mobile/.env

# 2. Gradle-wrapper for backend (bare én gang, og deretter sjekkes den inn)
cd backend && gradle wrapper --gradle-version 9.8.2 && cd ..

# 3. Avhengigheter for mobilappen
cd mobile && npm install && cd ..
```

## Starte hele systemet

Bruk tre terminaler, eller tre terminalfaner i VS Code.

```bash
# Terminal 1: database og e-post (Mailpit)
docker compose up -d

# Terminal 2: backend på http://localhost:8080
cd backend && ./gradlew bootRun

# Terminal 3: mobilapp i iPhone Simulator
cd mobile && npm run ios
```

Første gang `npm run ios` kjøres, installeres Expo Go i simulatoren. Når det fungerer, viser appen **Backend · Server: UP · Database: UP**.

Nyttige adresser:

- Helsesjekk: http://localhost:8080/api/health
- API-dokumentasjon: http://localhost:8080/swagger-ui.html
- Actuator: http://localhost:8080/actuator/health

## Tester og kontroller

```bash
# Backend: integrasjonstester mot ekte PostgreSQL (Docker må kjøre)
cd backend && ./gradlew test

# Mobil: typekontroll, lint og enhetstester
cd mobile && npm run typecheck && npm run lint && npm test
```

## Drift

Backend og database kjører på Railway (EU), bilder i Cloudflare R2. Oppsett steg for steg: [docs/deploy-railway.md](docs/deploy-railway.md).

## CI (GitHub Actions)

`.github/workflows/ci.yml` kjører på hver push til `main` og hver pull request:

- **Backend:** `./gradlew build` med Java 21. Testene starter PostgreSQL selv via Testcontainers, så CI trenger ingen `.env`.
- **Backend-bilde:** bygger `backend/Dockerfile`, det samme som Railway kjører.
- **Mobil:** `npm ci`, typesjekk, lint og Jest (Node 22).
- **Hemmelighetssjekk:** gitleaks stopper bygget hvis en nøkkel eller et passord er sjekket inn.

Dependabot (`.github/dependabot.yml`) foreslår oppdateringer for Gradle og GitHub Actions hver uke, og bare sikkerhetsfikser for npm (Expo-pakker oppgraderes samlet med `npx expo install --fix`).

## Slik fungerer appen (fase 2)

- Fanelinjen nederst har fem faner: **Hjem**, **Utforsk** (community-programmer og -rutiner, øvelser og personer), **Økt**, **Bibliotek** (øvelser) og **Profil**. Den native iOS-fanelinjen er flytende og gjennomskinnelig.
- Start en tom økt fra **Hjem** eller **Økt**, eller åpne en øvelse i **Bibliotek** og trykk *Start økt med denne øvelsen*.
- I økten skriver du kg og reps og trykker ✓. Lar du feltene stå tomme, brukes de grå forslagene: verdiene fra forrige gang eller fra forrige sett.
- Trykk på settnummeret for å bytte type: arbeidssett, **O**ppvarming, **F**ailure eller **D**ropsett. Hold inne for å slette settet.
- Alt lagres på telefonen med en gang. Fullførte økter lastes opp når det er nett. Status vises som «Synkronisert» eller «Venter på synk».
- **Innlogging:** Appen starter med innloggingsskjermen. Velg «Fortsett med e-post», skriv e-posten din og skriv inn koden. Lokalt finner du koden på <http://localhost:8025> (Mailpit) eller i backend-loggen. «Fortsett med Google» krever appens egen utviklerversjon, se [docs/auth.md](docs/auth.md). Første innlogging på en telefon med data beholder dataene. På en tom telefon hentes alt fra serveren.
- Backend må startes med `./gradlew bootRun`. I `local`-profilen kjøres forespørsler uten token som utviklingsbrukeren (praktisk for curl og Swagger).
- **Du** har tre faner. **Oversikt** viser varighet, volum eller antall økter per uke for valgt periode, musklene du har trent denne uka, månedskalender med ukesrekke og muskelfordeling. **Øvelser** viser alle øvelser du har trent, med estimert 1RM og en minigraf. **Målinger** viser vekt, vektmål, innveiinger, vektendringer, kroppsmål, kroppsfett og høyde. Målinger lagres lokalt og synkes som økter.
- **Ny profil:** Etter første innlogging kommer en velkomstflyt med tre steg. Først navn og bilde, så brukernavn (sjekkes mens du skriver), så fødselsdato, kjønn, høyde og vekt. Fornavn, brukernavn og fødselsdato er påkrevd, og du må være minst 13 år. Fødselsdato, kjønn, høyde og vekt vises aldri for andre.
- **Offentlig profil:** Andre kan se navn, @brukernavn, bilde, bio, antall treninger og lenker (`/user/<brukernavn>`). Under Innstillinger → Personvern kan du gjøre profilen privat. Da vises bare navn, bilde og bio. Der kan du også se profilen slik andre ser den.
- **Dele programmer og rutiner:** Åpne et program eller en frittstående rutine i Bibliotek og velg under **Deling** hvem som kan se det: **Bare meg** (standard), **Følgere** eller **Offentlig**. Delte programmer kan få nivå og dager per uke. Andre finner dem i Utforsk (seksjonene «Fra folk du følger», «Populære», «Nyeste») og på profilen din, og kan **laste ned** en egen kopi. Du får et varsel når noen laster ned. Bruker rutinen dine egne øvelser, får mottakeren en kopi av dem.
- **Kreditering:** En nedlastet kopi viser alltid «Basert på «…» av …» med lenke til profilen til den som laget originalen, også når kopien endres og deles videre.
- **Trygghet:** «…» på økter, kommentarer (hold inne), profiler og delte programmer/rutiner gir **Rapporter**. På profiler kan du også **blokkere**. Blokkerte brukere ses under Innstillinger → Trygghet. Moderatorer får **Moderering** i Innstillinger (se `docs/moderation.md`). Nye brukere godtar vilkår, personvernerklæring og retningslinjer og bekrefter at de er minst 13 år før velkomstflyten.
- **Brukervennlighet og universell utforming:** Appen følger WCAG 2.1 AA og Benyons designprinsipper. Se `docs/ux-and-accessibility.md` for hva som er gjort, sjekkliste for nye skjermer og hvordan du tester med VoiceOver og stor tekst.
- **Under økten:** Hviletimeren varsler også når appen er i bakgrunnen. Nye rekorder vises med en gang du fullfører settet. Øvelsesmenyen har supersett (med neste øvelse), skivekalkulator og flytting.
- **Fremgang:** Grafer for tyngste sett, estimert 1RM og volum per øvelse. Ukesmål settes i Innstillinger og vises på Hjem. Månedsoppsummering (Du → profil) og delingsbilde av økter.
- **Kommentarer og partnere:** Svar og liker på kommentarer, @omtale med forslag mens du skriver, og «Trente med» på egne økter.
- **Enheter:** Velg kg eller lb i Innstillinger (gjelder treningsvekter; alt lagres i kg).
- **Feil:** Krasjer en skjerm, vises en feilside og feilen logges på serveren (`client-errors`-loggen).
- **Følge andre:** Utforsk → **Personer** søker etter navn og @brukernavn. På en profil kan du trykke **Følg**. Er profilen privat, blir det en forespørsel som eieren godtar under Du → **Følgeforespørsler**. Følgere og Følger vises på profilene og kan åpnes som lister, og på din egen liste kan du fjerne følgere. Øktene til andre ser du bare når du følger dem, uten private notater.
- **Feed:** Hjem viser dine økter og øktene til dem du følger, nyest først. Dra ned for å oppdatere, og flere lastes når du ruller. Uten nett vises bare dine egne økter. Hvert innlegg har tommel opp, kommentarer («Vær den første som liker!») og opptil 4 bilder.
- **Synlighet per økt:** På «Fullfør økt» velger du **Følgere** (standard), **Offentlig** eller **Bare meg**. Du kan endre det senere på økten, og standarden velger du under Innstillinger → Personvern. På økten legger du også til bilder. De gjøres om til JPEG på telefonen (iPhone bruker ofte HEIC) og vises i full bredde i feeden og på økten. Trykk på et bilde for fullskjerm.
- **Varsler:** Bjellen på Hjem viser nye følgere, forespørsler, liker og kommentarer.
- **Profilbilder** lastes opp til backend. Den beskjærer dem til 512×512 JPEG og fjerner metadata som GPS-posisjon. Lokalt lagres de i `backend/data/media`.
- Profilbildet øverst til venstre åpner **profilen din**: bilde, navn, antall treninger, ukesrekke, totalt volum og ukesgraf. Under «Rediger profil» setter du fornavn, etternavn, bio, fødselsdato, kjønn, vekt (lagres som innveiing) og brukernavn på Instagram, TikTok, YouTube og nettside. Feltene synkes til serveren, også profilbildet. Fra profilen åpner du også **Treningshistorie** (alle økter som kort) og **Statistikk** (i år, hele tiden og beste løft i benkpress, knebøy og markløft). Følgere og innlegg kommer med community.
- Tannhjulet på Du åpner **Innstillinger**, med «Synkroniser nå», **Logg ut**, **Slett konto** og backend-status for utvikling.

## Android

Installer Android Studio og lag en emulator. Sett `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080` i `mobile/.env`, fordi Android Emulator når Mac-en via 10.0.2.2. Kjør deretter `npm run android`.

## Feilsøking

- **Appen viser «Fikk ikke kontakt med …»:** Sjekk at backend kjører, og at http://localhost:8080/api/health svarer i nettleseren.
- **`Database: DOWN`:** Sjekk at Docker Desktop og `docker compose ps` viser postgres som `healthy`.
- **Port 5433 er opptatt:** Endre `POSTGRES_PORT` i `.env`.
- **Gradle finner ikke Java 21:** Kjør `export JAVA_HOME=$(/usr/libexec/java_home -v 21)`.

## Regler

- Databaseendringer gjøres bare via nye Flyway-filer i `backend/src/main/resources/db/migration`.
- Hemmeligheter skal aldri inn i kildekoden eller mobilappen. Bruk `.env` lokalt og en secrets manager i drift.
- Lyftas logo, grafikk, øvelsesdata og videoer brukes ikke. Vi lager egne ressurser eller bruker lisensierte.
