# Trygghet og moderering

## Blokkering
- `PUT /api/users/{username}/block`, `DELETE …/block`, `GET /api/me/blocks`.
- Virker begge veier: ingen av dere ser den andres profil, økter, kommentarer, liker, delte programmer/rutiner eller varsler, og dere finner ikke hverandre i søk. Følging begge veier og varsler mellom dere slettes. Den blokkerte får ikke beskjed.
- Den som blokkerer ser fortsatt navn og bilde på profilen (`blockedByYou: true`) for å kunne oppheve blokkeringen. For den blokkerte finnes profilen ikke (404).
- Reglene ligger i `social/Blocks.visibleUser(...)`, som brukes i feed, profiler, søk, følgerlister, kommentarer, liker, varsler og Utforsk.

## Rapportering
- `POST /api/reports` med `{id, targetType, targetId, reason, details}`. `targetType`: USER, WORKOUT, COMMENT, PROGRAM, ROUTINE.
- Man kan bare rapportere det man selv kan se, og ikke sitt eget innhold. Samme person kan ha én åpen rapport per innhold (idempotent).
- Rapporten lagrer en tekstkopi (`snapshot`), så moderatorer ser hva som ble rapportert selv om det endres.

## Moderatorer
Roller settes manuelt i databasen (ingen grensesnitt for å gi roller, med vilje):

```sql
UPDATE users SET role = 'MODERATOR' WHERE username = 'brukernavn';
```

Lokalt: `docker compose exec postgres psql -U fitness -d fitness -c "UPDATE users SET role = 'MODERATOR' WHERE username = 'sigurd';"`
(bytt brukernavn, database og bruker til det som står i `.env`). Logg ut og inn igjen, eller start appen på nytt, så dukker **Moderering** opp i Innstillinger.

Tiltak (`POST /api/moderation/reports/{id}/resolve`), gjelder alle åpne rapporter på samme innhold:

| Tiltak | Virkning |
|---|---|
| `DISMISS` | Ingen endring. |
| `REMOVE_CONTENT` | Økt, program og rutine gjøres private (eieren beholder dem). Kommentar slettes. Profil: bio, lenker og bilde fjernes. |
| `SUSPEND_USER` | Kontoen sperres: alle økter logges ut, ny innlogging nektes (403), og innholdet skjules for andre. Oppheves med `DELETE /api/moderation/users/{userId}/suspension`. |

## Vilkår og aldersgrense
- `app.terms.version` (env `TERMS_VERSION`) er gjeldende versjon. Appen viser vilkårene før velkomstflyten og når versjonen endres. `PUT /api/me/terms {version, confirmsMinimumAge}`.
- Minstealder 13 år (samtykkealder for informasjonssamfunnstjenester i Norge). Serveren avviser fødselsdato som gir lavere alder.
- Tekstene ligger i `mobile/src/features/legal/documents.ts`. **De er et utkast og må gjennomgås juridisk før lansering** (behandlingsansvarlig, kontaktadresse og lagringstider må fylles inn).
