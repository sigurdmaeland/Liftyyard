import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'fitness.db';

/**
 * Lokale migreringer, styrt av PRAGMA user_version. Samme regel som på serveren:
 * eksisterende steg endres aldri. Endringer legges til som et nytt steg.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE exercises (
    id                TEXT PRIMARY KEY NOT NULL,
    name              TEXT NOT NULL,
    exercise_type     TEXT NOT NULL,
    equipment         TEXT NOT NULL,
    primary_muscles   TEXT NOT NULL,   -- JSON-liste, kun for visning/filtrering
    secondary_muscles TEXT NOT NULL,
    updated_at        TEXT
  );

  CREATE TABLE workouts (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    notes       TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    status      TEXT NOT NULL CHECK (status IN ('active', 'finished')),
    sync_status TEXT NOT NULL DEFAULT 'local' CHECK (sync_status IN ('local', 'pending', 'synced', 'failed')),
    sync_error  TEXT,
    updated_at  TEXT NOT NULL
  );
  -- Maks én aktiv økt om gangen.
  CREATE UNIQUE INDEX workouts_one_active ON workouts (status) WHERE status = 'active';
  CREATE INDEX workouts_ended ON workouts (ended_at DESC);

  CREATE TABLE workout_exercises (
    id            TEXT PRIMARY KEY NOT NULL,
    workout_id    TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    exercise_id   TEXT NOT NULL,
    exercise_name TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    notes         TEXT
  );
  CREATE INDEX workout_exercises_workout ON workout_exercises (workout_id, position);
  CREATE INDEX workout_exercises_exercise ON workout_exercises (exercise_id);

  CREATE TABLE workout_sets (
    id                  TEXT PRIMARY KEY NOT NULL,
    workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises (id) ON DELETE CASCADE,
    position            INTEGER NOT NULL,
    set_type            TEXT NOT NULL DEFAULT 'NORMAL',
    weight_kg           REAL,
    reps                INTEGER,
    rpe                 REAL,
    duration_seconds    INTEGER,
    distance_m          REAL,
    completed_at        TEXT
  );
  CREATE INDEX workout_sets_exercise ON workout_sets (workout_exercise_id, position);
  `,
  // 2: Beskrivelse (kan deles senere) og opplevd anstrengelse 1–10 fra «Fullfør økt».
  `
  ALTER TABLE workouts ADD COLUMN description TEXT;
  ALTER TABLE workouts ADD COLUMN perceived_effort INTEGER;
  `,
  // 3: Slettinger som skal sendes til serveren (gjøres lokalt med en gang, synkes når det er nett).
  `
  CREATE TABLE pending_deletions (
    workout_id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );
  `,
  // 4: Programmer og rutiner (redigeres lokalt, synkes som hele programmer).
  `
  CREATE TABLE programs (
    id          TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_error  TEXT
  );

  CREATE TABLE routines (
    id         TEXT PRIMARY KEY NOT NULL,
    program_id TEXT NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL,
    name       TEXT NOT NULL,
    notes      TEXT
  );
  CREATE INDEX routines_program ON routines (program_id, position);

  CREATE TABLE routine_exercises (
    id            TEXT PRIMARY KEY NOT NULL,
    routine_id    TEXT NOT NULL REFERENCES routines (id) ON DELETE CASCADE,
    position      INTEGER NOT NULL,
    exercise_id   TEXT NOT NULL,
    exercise_name TEXT NOT NULL,
    exercise_type TEXT NOT NULL,
    notes         TEXT,
    rest_seconds  INTEGER
  );
  CREATE INDEX routine_exercises_routine ON routine_exercises (routine_id, position);

  CREATE TABLE routine_sets (
    id                      TEXT PRIMARY KEY NOT NULL,
    routine_exercise_id     TEXT NOT NULL REFERENCES routine_exercises (id) ON DELETE CASCADE,
    position                INTEGER NOT NULL,
    set_type                TEXT NOT NULL DEFAULT 'NORMAL',
    target_reps             INTEGER,
    target_weight_kg        REAL,
    target_duration_seconds INTEGER
  );
  CREATE INDEX routine_sets_exercise ON routine_sets (routine_exercise_id, position);

  CREATE TABLE pending_program_deletions (
    program_id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );

  ALTER TABLE workouts ADD COLUMN source_routine_id TEXT;
  `,
  // 5: Frittstående rutiner (program_id kan være NULL) med egen synk, favoritter og egendefinerte øvelser.
  `
  CREATE TABLE routines_new (
    id             TEXT PRIMARY KEY NOT NULL,
    program_id     TEXT REFERENCES programs (id) ON DELETE CASCADE,
    position       INTEGER NOT NULL DEFAULT 0,
    name           TEXT NOT NULL,
    notes          TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    sync_status    TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_error     TEXT,
    is_favorite    INTEGER NOT NULL DEFAULT 0,
    favorite_dirty INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO routines_new (id, program_id, position, name, notes, created_at, updated_at)
    SELECT r.id, r.program_id, r.position, r.name, r.notes, p.created_at, p.updated_at
    FROM routines r JOIN programs p ON p.id = r.program_id;
  DROP TABLE routines;
  ALTER TABLE routines_new RENAME TO routines;
  CREATE INDEX routines_program ON routines (program_id, position);

  CREATE TABLE pending_routine_deletions (
    routine_id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL
  );

  ALTER TABLE exercises ADD COLUMN instructions TEXT;
  ALTER TABLE exercises ADD COLUMN custom INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE exercises ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE exercises ADD COLUMN favorite_dirty INTEGER NOT NULL DEFAULT 0;
  -- synced = speiler serveren; pending = egendefinert øvelse endret lokalt.
  ALTER TABLE exercises ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'synced';
  ALTER TABLE exercises ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
  `,
  // 6: Programmer lastet ned fra Utforsk husker originalen.
  `
  ALTER TABLE programs ADD COLUMN source_program_id TEXT;
  `,
  // 7: Kroppsmålinger (vekt, kroppsfett, høyde, omkrets) og brukerinnstillinger (vektmål).
  `
  CREATE TABLE body_measurements (
    id          TEXT PRIMARY KEY NOT NULL,
    kind        TEXT NOT NULL,
    value       REAL NOT NULL CHECK (value > 0),
    measured_at TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    sync_error  TEXT
  );
  CREATE INDEX body_measurements_kind ON body_measurements (kind, measured_at);

  CREATE TABLE pending_measurement_deletions (
    measurement_id TEXT PRIMARY KEY NOT NULL,
    created_at     TEXT NOT NULL
  );

  -- Nøkkel/verdi for brukerinnstillinger. dirty = endret lokalt, ikke sendt til serveren ennå.
  CREATE TABLE user_settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT,
    dirty INTEGER NOT NULL DEFAULT 0
  );
  `,
  // 8: Synlighet per økt (PUBLIC / FOLLOWERS / PRIVATE) og bilder på økter.
  `
  ALTER TABLE workouts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'FOLLOWERS';

  -- file = lokal fil som venter på opplasting; remote_url = adressen når den er lastet opp.
  -- sync_status: pending (lastes opp), synced, deleted (slettes på serveren, så fjernes raden).
  CREATE TABLE workout_photos (
    id          TEXT PRIMARY KEY NOT NULL,
    workout_id  TEXT NOT NULL REFERENCES workouts (id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    file        TEXT,
    remote_url  TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'deleted')),
    created_at  TEXT NOT NULL
  );
  CREATE INDEX workout_photos_workout ON workout_photos (workout_id, position);
  `,
  // 9: Feilmelding når serveren avviser et bilde. Da prøves det ikke automatisk igjen før brukeren ber om det.
  `
  ALTER TABLE workout_photos ADD COLUMN upload_error TEXT;
  `,
  // 10: Deling i community. Programmer og frittstående rutiner kan deles med følgere eller alle.
  `
  ALTER TABLE programs ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE';
  ALTER TABLE programs ADD COLUMN level TEXT;
  ALTER TABLE programs ADD COLUMN days_per_week INTEGER;
  ALTER TABLE routines ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE';
  ALTER TABLE routines ADD COLUMN source_routine_id TEXT;
  `,
  // 11: Kreditt («basert på») som JSON fra serveren, og hvilken rutine en lokal duplikat kom fra.
  `
  ALTER TABLE programs ADD COLUMN credit TEXT;
  ALTER TABLE routines ADD COLUMN credit TEXT;
  ALTER TABLE routines ADD COLUMN copied_from_routine_id TEXT;
  `,
  // 12: Supersett i økter (samme gruppenummer på øvelser som gjøres etter hverandre).
  `
  ALTER TABLE workout_exercises ADD COLUMN superset_group INTEGER;
  `,
  // 13: Forsidebilde på programmer. cover_url er bildet på serveren; cover_file et nytt bilde som venter
  // på opplasting; cover_action er det som skal gjøres ved neste synk ('upload' eller 'remove').
  `
  ALTER TABLE programs ADD COLUMN cover_url TEXT;
  ALTER TABLE programs ADD COLUMN cover_file TEXT;
  ALTER TABLE programs ADD COLUMN cover_action TEXT;
  ALTER TABLE programs ADD COLUMN cover_error TEXT;
  `,
];

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  // Fremmednøkler slås av under migrering, slik at tabeller kan bygges om (SQLite kan ikke endre
  // NOT NULL på en kolonne) uten at ON DELETE CASCADE sletter data i andre tabeller.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const step = MIGRATIONS[version];
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(step);
    });
    version += 1;
    // PRAGMA støtter ikke parameterbinding; versjonen er et internt heltall.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
  await db.execAsync('PRAGMA foreign_keys = ON;');
}
