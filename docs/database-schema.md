# Databaseskjema

Kilde: Flyway-migreringene i `backend/src/main/resources/db/migration`. Dette dokumentet forklarer *hvorfor*.

## Tabeller (fase 2)

```text
users ─┬─< exercises (owner_user_id, null = felles katalog) ─< exercise_muscles
       └─< workouts ─< workout_exercises ─< workout_sets
                              └─ exercise_id → exercises (ON DELETE SET NULL)
```

| Tabell | Innhold |
|---|---|
| `users` | Bruker. Ingen passord, fordi innlogging skjer via Apple/Google (se under). |
| `exercises` | Øvelsesbiblioteket. Felles katalog (`owner_user_id IS NULL`) og brukerens egne øvelser. Arkiveres med `archived_at`, slettes ikke. |
| `exercise_muscles` | Primære og sekundære muskler per øvelse. |
| `workouts` | Fullført økt med start og slutt. |
| `workout_exercises` | Øvelse i en økt, med rekkefølge (`position`) og **øyeblikksbilde** av navn og type. |
| `workout_sets` | Sett: type, vekt (kg), reps, RPE, varighet, distanse og tidspunkt for fullføring. |

## Regler og begrunnelser

- **Øyeblikksbilde.** `workout_exercises.exercise_name` og `exercise_type` kopieres når økten lagres. Det gjør at historikken ikke endres når en øvelse får nytt navn eller en rutine endres. Dette dekkes av en test (`historyIsNotChangedWhenLibraryExerciseIsRenamed`).
- **ID-er lages av klienten.** Appen lager UUID-er for økter, øvelser i økten og sett. `PUT /api/workouts/{id}` erstatter hele økten, så samme forespørsel kan sendes flere ganger etter nettverksbrudd uten at det oppstår duplikater.
- **Rekkefølge** utledes av rekkefølgen i forespørselen og lagres som `position`, med `UNIQUE (parent, position)`.
- **Enheter.** Vekt lagres i kg som `numeric(7,2)`, varighet i sekunder og distanse i meter. Visningsenheten (kg/lb) blir en brukerinnstilling.
- **Tid.** Alle tidspunkter lagres som `timestamptz` (UTC).
- **Enum-verdier** lagres som tekst med `CHECK`-constraint. Det er lesbart og enkelt å utvide med en ny migrering.
- **Sletting.** Sletter man en bruker, slettes også brukerens data (`ON DELETE CASCADE`). Sletter man en øvelse fra biblioteket, beholdes historikken (`SET NULL` og navnet i øyeblikksbildet).

## Programmer og rutiner (V5)

```text
users ─< programs ─< routines ─< routine_exercises ─< routine_sets
```

- Et **program** (f.eks. «PPL») har **rutiner** (treningsdager). Hver rutine har øvelser med **målsett**: type, reps, kg og sekunder.
- `programs.visibility` (`PRIVATE`/`PUBLIC`) og `owner_user_id` er forberedt for community. I dag er alt privat.
- Programmet er et aggregat. `PUT /api/programs/{id}` erstatter hele programmet idempotent, med ID-er laget av klienten.
- Når en rutine **startes**, kopieres den inn i en ny økt. Målene fylles inn som verdier, og økten får `source_routine_id` uten fremmednøkkel. Endringer i eller sletting av rutinen påvirker derfor aldri gjennomførte økter.
- På telefonen markeres programmet `pending` ved hver endring. Det markeres som `synced` bare hvis `updated_at` ikke er endret mens opplastingen pågikk.

## Frittstående rutiner, favoritter og egne øvelser (V6)

- **Rutiner** er egne aggregater (`PUT /api/routines/{id}`) med `owner_user_id`. `program_id` kan være NULL, og da står rutinen alene. Et program er bare navn og beskrivelse (`PUT /api/programs/{id}`). Sletting av et program sletter også rutinene i det.
- Rekkefølgen i et program (`position`) er bare sortering og er ikke unik, slik at to rutiner kan bytte plass med to separate forespørsler.
- **Favoritter** lagres i `routine_favorites` og `exercise_favorites` og settes med idempotente `PUT`/`DELETE …/favorite`. Når en rutine lagres på nytt, beholdes favoritten.
- **Egendefinerte øvelser:** `PUT /api/exercises/{id}` gir eieren brukeren. Katalogøvelser kan ikke endres (409). `DELETE` arkiverer øvelsen, så historikk og rutiner beholder navnet.
- **Synk fra telefonen** skjer i denne rekkefølgen: egne øvelser → programmer → rutiner → favoritter → økter. Slettinger går før opplastinger.

## Kroppsmålinger og innstillinger (V9)

- `body_measurements (id, user_id, kind, value, measured_at)`: én rad per måling. `kind` er `WEIGHT` (kg), `BODY_FAT` (%), `HEIGHT` (cm) eller et omkretsmål i cm (`WAIST`, `CHEST`, `LEFT_ARM` …). Faste enheter per type gjør at kg/lb senere bare er visning.
- `PUT /api/measurements/{id}` er idempotent med ID fra klienten. `GET /api/measurements` gir alle brukerens målinger, og `DELETE` sletter en måling.
- `user_settings (user_id, goal_weight_kg)`: brukerinnstillinger, foreløpig bare vektmål. `GET`/`PUT /api/settings`.
- På telefonen ligger målinger i `body_measurements` (lokal migrering 7) med `sync_status`, slettinger i `pending_measurement_deletions` og innstillinger i `user_settings` (nøkkel/verdi med `dirty`-flagg). Synk-rekkefølgen er nå: egne øvelser → programmer → rutiner → favoritter → økter → målinger og innstillinger.

## Profil (V10)

- `users` har fått `first_name`, `last_name`, `bio`, `birth_date`, `gender` (`MALE`/`FEMALE`/`OTHER`, valgfritt), `instagram`, `tiktok`, `youtube` og `website`. `display_name` settes til «fornavn etternavn» ved lagring.
- `GET`/`PUT /api/me` leser og erstatter profilen. Brukernavn lagres uten «@». Fornavn er påkrevd.
- På telefonen ligger profilen som JSON i `user_settings` (nøkkel `profile`, med `dirty`-flagg). Profilbildet ligger bare lokalt i appens dokumentmappe til vi har medialagring.

## Innlogging (V11)

- `user_identities (provider, subject, user_id, email)`: én rad per innloggingsmetode (`GOOGLE`, `EMAIL`, senere `APPLE`).
- `email_login_codes`: engangskoder for e-postinnlogging (bare HMAC av koden, utløp og antall forsøk).
- `refresh_tokens`: hash av fornyelsestokens med `family_id` for gjenbruksdeteksjon. Se [auth.md](auth.md).

## Brukernavn, synlighet og profilbilder (V12)

- `users.username`: unikt, små bokstaver, 3–30 tegn (a–z, 0–9, `.` og `_`). Noen navn er reservert (se `UsernameRules`). `PUT /api/me/username` setter det, og `GET /api/usernames/{navn}` sjekker om det er ledig.
- `users.visibility`: `PUBLIC` (standard) eller `PRIVATE`. `GET /api/users/{brukernavn}` gir aldri fødselsdato, kjønn, vekt eller kroppsmål. For private profiler vises bare navn, brukernavn, bilde og bio.
- `users.avatar_key`: nøkkel til profilbildet i lagringen. `PUT /api/me/avatar` (multipart) beskjærer, skalerer til 512×512 og lagrer en ny JPEG uten metadata. Originalen lagres ikke.
- **Lagring:** Lokalt i en mappe (`MEDIA_DIR`), og backend serverer bildene på `/media/...`. Grensesnittet `MediaStorage` gjør at vi kan bytte til S3 eller Cloudflare R2 når vi velger skytilbyder. MinIO ble valgt bort fordi prosjektet sluttet å publisere Docker-images i oktober 2025.

## Følging (V13)

- `follows (follower_id, followee_id, status)`: `ACCEPTED`, eller `PENDING` for private profiler til eieren godtar. Man kan ikke følge seg selv.
- **Tilgang:** Økter (`GET /api/users/{u}/workouts`) ser bare eieren og godtatte følgere, og private notater fjernes. Følgerlister ser alle for offentlige profiler, men bare følgere for private. Synlighet per økt («Offentlig») kommer med feeden.
- Endepunkter: `GET /api/users/search?q=`, `POST`/`DELETE /api/users/{u}/follow`, `GET /api/users/{u}/followers|following`, `GET /api/me/follow-requests`, `POST /api/me/follow-requests/{u}/accept`, `DELETE /api/me/follow-requests/{u}` og `DELETE /api/me/followers/{u}`.

## Feed, liker, kommentarer, bilder og varsler (V14)

- `workouts.visibility`: `PUBLIC`, `FOLLOWERS` (standard) eller `PRIVATE`. Regelen står i `WorkoutAccess`. Eieren ser alt. `PUBLIC` ser alle som kan se profilen, og `FOLLOWERS` ser godtatte følgere. Økter man ikke har tilgang til gir 404.
- **Økter oppdateres på stedet** når de synkes på nytt. Bare øvelser og sett byttes ut, så liker, kommentarer og bilder (som har fremmednøkkel til `workouts`) består.
- `workout_likes` (én per bruker), `workout_comments` (1–1000 tegn, idempotent på klientens ID) og `workout_photos` (maks 4 per økt, skalert til maks 1600 px uten metadata).
- `notifications`: FOLLOW, FOLLOW_REQUEST, FOLLOW_ACCEPTED, LIKE og COMMENT. Det blir aldri varsel til seg selv, og en liker eller følging gir ikke dobbelt varsel.
- **Feed** (`GET /api/feed?before=`): egne økter og øktene (PUBLIC/FOLLOWERS) til dem man følger, nyeste først, i sider med «før»-markør. `GET /api/users/{u}/workouts` bruker de samme tilgangsreglene.
- **Telefonen:** lokal migrering 8 gir `workouts.visibility` og `workout_photos`. Bilder lastes opp etter at økten er synket.

## Deling av programmer og rutiner (V15)

- `programs.visibility` tillater nå `PRIVATE`, `FOLLOWERS` og `PUBLIC` (før bare `PRIVATE`/`PUBLIC`).
- `routines.visibility` (samme verdier, standard `PRIVATE`) gjelder frittstående rutiner. Rutiner i et program deles sammen med programmet.
- `routines.download_count` og `routines.source_routine_id` (kopien husker originalen, uten fremmednøkkel, så originalen kan slettes).
- `notifications.type` har fått `DOWNLOAD`, med `program_id`/`routine_id` (ON DELETE CASCADE).
- Synlighet i Utforsk og på profiler: `PUBLIC` ses av alle som kan se eierens profil, `FOLLOWERS` av godtatte følgere. `PRIVATE` vises aldri, heller ikke for eieren (eget innhold ligger i Bibliotek). Det man ikke kan se gir 404.
- Nedlasting kopierer programmet/rutinen (privat kopi, nye ID-er, idempotent på `copyId`). Bruker originalen forfatterens egne øvelser, får mottakeren en kopi av dem (med muskler), eller gjenbruker en egen øvelse med samme navn.

## Kreditering av opphav (V16)

- `programs.origin_program_id`, `routines.origin_routine_id`, samt `origin_user_id` (ON DELETE SET NULL), `origin_author_name` og `origin_name` på begge.
- Peker alltid til første opphav: lastes en kopi ned og deles videre, beholdes kreditten til den som laget originalen. Navnene er øyeblikksbilder, så kreditten står igjen hvis originalen eller kontoen slettes.
- API-ene returnerer dette som `basedOn` (med oppdatert brukernavn og bilde når kontoen finnes). En lokal duplikat sender `copiedFromRoutineId`, så kreditten følger med.
- `remixCount` i Utforsk: antall delte programmer som bygger på programmet.

## Blokkering, rapporter, moderering og vilkår (V17)

- `users.role` (USER/MODERATOR/ADMIN), `users.suspended_at`, `users.terms_version`, `users.terms_accepted_at`.
- `blocks (blocker_id, blocked_id)`.
- `reports` med mål (type + id + eier), grunn, detaljer, tekstkopi, status (OPEN/RESOLVED/DISMISSED) og tiltak. Én åpen rapport per person og innhold.
- Se `docs/moderation.md`.

## Supersett, kommentartråder, treningspartnere og innstillinger (V18)

- `workout_exercises.superset_group`: samme tall på flere øvelser i en økt = supersett.
- `workout_comments.parent_id`: svar (ett nivå; svar på svar henges på den øverste).
- `comment_likes (comment_id, user_id)`.
- `workout_partners (workout_id, user_id)`: «Trente med». Bare folk eieren følger eller blir fulgt av.
- Nye varseltyper: `COMMENT_LIKE`, `REPLY`, `TAG`, `MENTION` (@brukernavn i kommentarer, bare til dem som kan se økten).
- `user_settings.weekly_goal` (økter per uke) og `user_settings.weight_unit` (KG/LB). Vekter lagres alltid i kg.
- Rekorder (medaljer) regnes ut ved oppslag (`social/RecordCalculator`), med samme regel som appen: estimert 1RM (Epley), tyngste vekt og største settvolum; nye topp 3-verdier gir gull/sølv/bronse, første gang en øvelse logges gir ingen.

## Nytt navn (V19)

Systembrukeren som eier de ferdige programmene heter «Liftyard», også i kreditteringen på kopier.

## Forsidebilde på programmer (V20)

`programs.cover_key` peker til bildet i bildelagringen (`covers/<program>/<id>.jpg`, kvadrat, maks 1080 px, uten metadata).
Bare eieren kan endre det (`POST/DELETE /api/programs/{id}/cover`). En nedlastet kopi får sitt eget eksemplar av bildet,
så den beholder det selv om originalen endres eller slettes. Bildet slettes sammen med programmet og kontoen.

På telefonen (lokal migrering 13) ligger et nytt bilde som fil til programmet finnes på serveren; da lastes det opp,
og adressen fra serveren brukes (`cover_url`). Fjerning sendes på samme måte ved neste synk.

## Tilbakemeldinger (V21)

`feedback` lagrer meldinger fra «Få hjelp» i appen: feil (`BUG`), forslag (`IDEA`) og spørsmål til support (`SUPPORT`),
med appversjon og system. Maks 10 per bruker per time, idempotent på `id`. Moderatorer leser og lukker dem
(`GET /api/moderation/feedback`, `POST /api/moderation/feedback/{id}/done`). Slettes sammen med kontoen.
Support svarer på e-postadressen brukeren logget inn med.

## Beregninger

- **Rekord:** Tyngste fullførte arbeidssett i en øvelse er tyngre enn alt tidligere i samme øvelse. Første gang øvelsen logges, teller ikke.
- **Volum** = Σ vekt_kg × reps for sett som er *fullført* (`completed_at` er satt) og *ikke oppvarming*. Sett uten vekt eller reps bidrar ikke. Dette gjelder både failure- og dropsett. Implementert i `WorkoutVolume`.
- **Fullførte sett** = antall sett med `completed_at`, inkludert oppvarming.
- **Estimert 1RM** (Epley) = vekt × (1 + reps/30), bare for sett med 1–12 reps. Vises alltid som et estimat («Est. 1RM»).
- **Muskelfordeling** på Du › Oversikt: fullførte arbeidssett og volum per gruppe (Rygg, Bryst, Kjerne, Skuldre, Armer, Bein) ut fra øvelsens primærmuskler. Et sett som treffer flere grupper teller i hver av dem.
- **Vektendring** over N dager = siste måling minus den eldste målingen i vinduet. Krever minst to målinger.

## Planlagte utvidelser (krever bare nye tabeller/kolonner)

- `user_identities (user_id, provider APPLE|GOOGLE, subject, email)`. En bruker kan ha flere innloggingsmetoder.
- `workout_groups` og `workout_exercises.group_id` for supersett.
- `routines`, `routine_exercises` og `routine_exercise_sets` (fase 3). Når en økt startes fra en rutine, kopieres innholdet. Rutinen refereres bare via `workouts.source_routine_id`.
- `personal_records` og `progress_photos` (krever privat medialagring).
