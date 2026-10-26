import { File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';
import type { Credit, Level, RemoteProgram, RemoteRoutine } from '@/types/explore';
import type { Program, ProgramSummary, Routine, RoutineExercise, RoutineSet, ShareVisibility } from '@/types/program';
import type { Exercise, ExerciseType, SetType } from '@/types/workout';

/*
 * Programmer og rutiner redigeres lokalt og lagres med en gang. Et program er bare navn og
 * beskrivelse; rutiner er egne enheter (i et program eller frittstående) som synkes hver for seg
 * (PUT /api/routines/{id}). Hver endring markerer det berørte objektet som «pending».
 */

const nowIso = () => new Date().toISOString();

type SyncStatus = 'pending' | 'synced' | 'failed';
export type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: ShareVisibility;
  level: Level | null;
  days_per_week: number | null;
  source_program_id: string | null;
  credit: string | null;
  cover_url: string | null;
  cover_file: string | null;
  cover_action: 'upload' | 'remove' | null;
  cover_error: string | null;
  updated_at: string;
  sync_status: SyncStatus;
};
type RoutineRow = {
  id: string;
  program_id: string | null;
  program_name: string | null;
  position: number;
  name: string;
  notes: string | null;
  visibility: ShareVisibility;
  source_routine_id: string | null;
  credit: string | null;
  copied_from_routine_id: string | null;
  updated_at: string;
  sync_status: SyncStatus;
  is_favorite: number;
};
type RoutineExerciseRow = {
  id: string;
  routine_id: string;
  position: number;
  exercise_id: string;
  exercise_name: string;
  exercise_type: string;
  notes: string | null;
  rest_seconds: number | null;
};
type RoutineSetRow = {
  id: string;
  routine_exercise_id: string;
  position: number;
  set_type: SetType;
  target_reps: number | null;
  target_weight_kg: number | null;
  target_duration_seconds: number | null;
};

type Db = Pick<SQLiteDatabase, 'runAsync'>;

/** Kreditt lagres som JSON slik serveren sendte den. Ødelagt JSON behandles som ingen kreditt. */
export function parseCredit(json: string | null): Credit | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Credit;
  } catch {
    return null;
  }
}

const creditJson = (c: Credit | null | undefined) => (c ? JSON.stringify(c) : null);

// ---------- Forsidebilde (lokal fil) ----------

/** Lokal fil i dokumentmappen, hvis den finnes. */
function localCover(file: string | null): string | null {
  if (!file) return null;
  const f = new File(Paths.document, file);
  return f.exists ? f.uri : null;
}

function deleteCoverFile(file: string | null) {
  if (!file) return;
  try {
    const f = new File(Paths.document, file);
    if (f.exists) f.delete();
  } catch {
    // En fil som ikke kan slettes, skader ingenting.
  }
}

/** Det som skal vises: et nytt bilde som venter på opplasting, ellers bildet på serveren. */
const coverUriOf = (r: Pick<ProgramRow, 'cover_file' | 'cover_url'>) => localCover(r.cover_file) ?? r.cover_url;

const ROUTINE_SELECT = 'SELECT r.*, p.name AS program_name FROM routines r LEFT JOIN programs p ON p.id = r.program_id';

// ---------- Markering for synk ----------

async function touchProgram(db: Db, programId: string) {
  await db.runAsync("UPDATE programs SET updated_at = ?, sync_status = 'pending', sync_error = NULL WHERE id = ?", nowIso(), programId);
}

async function touchRoutine(db: Db, routineId: string) {
  await db.runAsync("UPDATE routines SET updated_at = ?, sync_status = 'pending', sync_error = NULL WHERE id = ?", nowIso(), routineId);
}

async function touchByRoutineExercise(db: Db, routineExerciseId: string) {
  await db.runAsync(
    `UPDATE routines SET updated_at = ?, sync_status = 'pending', sync_error = NULL
     WHERE id = (SELECT routine_id FROM routine_exercises WHERE id = ?)`,
    nowIso(),
    routineExerciseId,
  );
}

async function touchBySet(db: Db, setId: string) {
  await db.runAsync(
    `UPDATE routines SET updated_at = ?, sync_status = 'pending', sync_error = NULL
     WHERE id = (SELECT e.routine_id FROM routine_exercises e JOIN routine_sets s ON s.routine_exercise_id = e.id WHERE s.id = ?)`,
    nowIso(),
    setId,
  );
}

// ---------- Lesing ----------

async function loadRoutine(db: SQLiteDatabase, r: RoutineRow): Promise<Routine> {
  const exercises = await db.getAllAsync<RoutineExerciseRow>('SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY position', r.id);
  const sets = await db.getAllAsync<RoutineSetRow>(
    `SELECT s.* FROM routine_sets s JOIN routine_exercises e ON e.id = s.routine_exercise_id
     WHERE e.routine_id = ? ORDER BY s.position`,
    r.id,
  );
  return {
    id: r.id,
    programId: r.program_id,
    programName: r.program_name,
    position: r.position,
    name: r.name,
    notes: r.notes,
    favorite: r.is_favorite === 1,
    visibility: r.visibility,
    sourceRoutineId: r.source_routine_id,
    basedOn: parseCredit(r.credit),
    copiedFromRoutineId: r.copied_from_routine_id,
    updatedAt: r.updated_at,
    syncStatus: r.sync_status,
    exercises: exercises.map(
      (e): RoutineExercise => ({
        id: e.id,
        position: e.position,
        exerciseId: e.exercise_id,
        exerciseName: e.exercise_name,
        exerciseType: e.exercise_type as ExerciseType,
        notes: e.notes,
        restSeconds: e.rest_seconds,
        sets: sets
          .filter((s) => s.routine_exercise_id === e.id)
          .map(
            (s): RoutineSet => ({
              id: s.id,
              position: s.position,
              setType: s.set_type,
              targetReps: s.target_reps,
              targetWeightKg: s.target_weight_kg,
              targetDurationSeconds: s.target_duration_seconds,
            }),
          ),
      }),
    ),
  };
}

async function loadRoutines(db: SQLiteDatabase, where: string, ...params: (string | number)[]): Promise<Routine[]> {
  const rows = await db.getAllAsync<RoutineRow>(`${ROUTINE_SELECT} ${where}`, ...params);
  const out: Routine[] = [];
  for (const r of rows) out.push(await loadRoutine(db, r));
  return out;
}

export async function listPrograms(db: SQLiteDatabase): Promise<ProgramSummary[]> {
  const rows = await db.getAllAsync<ProgramRow & { routine_count: number }>(
    `SELECT p.*, (SELECT COUNT(*) FROM routines r WHERE r.program_id = p.id) AS routine_count
     FROM programs p ORDER BY p.updated_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    routineCount: r.routine_count,
    visibility: r.visibility,
    coverUri: coverUriOf(r),
    updatedAt: r.updated_at,
  }));
}

export async function getProgram(db: SQLiteDatabase, id: string): Promise<Program | null> {
  const row = await db.getFirstAsync<ProgramRow>('SELECT * FROM programs WHERE id = ?', id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    level: row.level,
    daysPerWeek: row.days_per_week,
    sourceProgramId: row.source_program_id,
    basedOn: parseCredit(row.credit),
    coverUri: coverUriOf(row),
    updatedAt: row.updated_at,
    syncStatus: row.sync_status,
    routines: await loadRoutines(db, 'WHERE r.program_id = ? ORDER BY r.position, r.created_at', row.id),
  };
}

export async function getRoutine(db: SQLiteDatabase, id: string): Promise<Routine | null> {
  const rows = await loadRoutines(db, 'WHERE r.id = ?', id);
  return rows[0] ?? null;
}

/** Alle rutiner, sist endret først (for «Rutiner»-filteret i Bibliotek). */
export async function listAllRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  return loadRoutines(db, 'ORDER BY r.updated_at DESC');
}

export async function listStandaloneRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  return loadRoutines(db, 'WHERE r.program_id IS NULL ORDER BY r.updated_at DESC');
}

export async function listFavoriteRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  return loadRoutines(db, 'WHERE r.is_favorite = 1 ORDER BY r.name COLLATE NOCASE');
}

// ---------- Program ----------

/** Oppretter et program med én tom rutine («Dag 1»), klart til redigering. */
export async function createProgram(db: SQLiteDatabase, name = 'Nytt program'): Promise<string> {
  const id = uuidv7();
  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync("INSERT INTO programs (id, name, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, 'pending')", id, name, now, now);
    await txn.runAsync(
      "INSERT INTO routines (id, program_id, position, name, created_at, updated_at, sync_status) VALUES (?, ?, 0, 'Dag 1', ?, ?, 'pending')",
      uuidv7(),
      id,
      now,
      now,
    );
  });
  return id;
}

export async function updateProgramDetails(db: SQLiteDatabase, id: string, name: string, description: string | null) {
  await db.runAsync('UPDATE programs SET name = ?, description = ? WHERE id = ?', name, description, id);
  await touchProgram(db, id);
}

/** Hvem som kan se og laste ned programmet (rutinene i det følger med). */
export async function setProgramVisibility(db: SQLiteDatabase, id: string, visibility: ShareVisibility) {
  await db.runAsync('UPDATE programs SET visibility = ? WHERE id = ?', visibility, id);
  await touchProgram(db, id);
}

/** Nivå og dager per uke vises på programkortet i Utforsk. null fjerner verdien lokalt. */
export async function setProgramFacts(db: SQLiteDatabase, id: string, level: Level | null, daysPerWeek: number | null) {
  await db.runAsync('UPDATE programs SET level = ?, days_per_week = ? WHERE id = ?', level, daysPerWeek, id);
  await touchProgram(db, id);
}

/** Sletter programmet og rutinene i det lokalt, og legger slettingen i kø til serveren. */
export async function deleteProgram(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<{ cover_file: string | null }>('SELECT cover_file FROM programs WHERE id = ?', id);
  deleteCoverFile(row?.cover_file ?? null);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM programs WHERE id = ?', id);
    await txn.runAsync('INSERT OR IGNORE INTO pending_program_deletions (program_id, created_at) VALUES (?, ?)', id, nowIso());
  });
}

/**
 * Nytt forsidebilde. Bildet kopieres til appens dokumentmappe og vises med en gang; det lastes opp
 * når programmet finnes på serveren (neste synk). Et tidligere bilde som ikke er lastet opp, slettes.
 */
export async function setProgramCover(db: SQLiteDatabase, id: string, sourceUri: string) {
  const row = await db.getFirstAsync<{ cover_file: string | null }>('SELECT cover_file FROM programs WHERE id = ?', id);
  const file = `cover-${uuidv7()}.jpg`;
  new File(sourceUri).copy(new File(Paths.document, file));
  await db.runAsync("UPDATE programs SET cover_file = ?, cover_action = 'upload', cover_error = NULL WHERE id = ?", file, id);
  deleteCoverFile(row?.cover_file ?? null);
}

/** Fjerner forsidebildet. Er det lastet opp, slettes det på serveren ved neste synk. */
export async function removeProgramCover(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<{ cover_file: string | null; cover_url: string | null }>(
    'SELECT cover_file, cover_url FROM programs WHERE id = ?',
    id,
  );
  if (!row) return;
  deleteCoverFile(row.cover_file);
  await db.runAsync(
    'UPDATE programs SET cover_file = NULL, cover_url = NULL, cover_action = ?, cover_error = NULL WHERE id = ?',
    row.cover_url ? 'remove' : null,
    id,
  );
}

/** Lager en egen kopi av programmet med alle rutinene (privat). Bildet følger med hvis det finnes på telefonen. */
export async function duplicateProgram(db: SQLiteDatabase, programId: string): Promise<string | null> {
  const source = await getProgram(db, programId);
  if (!source) return null;
  const row = await db.getFirstAsync<{ cover_file: string | null }>('SELECT cover_file FROM programs WHERE id = ?', programId);
  const id = uuidv7();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO programs (id, name, description, visibility, level, days_per_week, credit, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, 'PRIVATE', ?, ?, ?, ?, ?, 'pending')`,
    id, `${source.name} (kopi)`.slice(0, 100), source.description, source.level, source.daysPerWeek, creditJson(source.basedOn), now, now,
  );
  for (const r of source.routines) {
    const copy = await duplicateRoutine(db, r.id);
    if (copy) {
      await db.runAsync("UPDATE routines SET program_id = ?, position = ?, name = ? WHERE id = ?", id, r.position, r.name, copy);
    }
  }
  const local = localCover(row?.cover_file ?? null);
  if (local) await setProgramCover(db, id, local);
  return id;
}

// ---------- Rutiner ----------

/** Ny rutine, sist i programmet, eller frittstående når programId er null. */
export async function createRoutine(db: SQLiteDatabase, programId: string | null): Promise<string> {
  const id = uuidv7();
  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const next = programId
      ? await txn.getFirstAsync<{ n: number; pos: number }>(
          'SELECT COUNT(*) AS n, COALESCE(MAX(position) + 1, 0) AS pos FROM routines WHERE program_id = ?',
          programId,
        )
      : await txn.getFirstAsync<{ n: number; pos: number }>('SELECT COUNT(*) AS n, 0 AS pos FROM routines WHERE program_id IS NULL');
    const name = programId ? `Dag ${(next?.n ?? 0) + 1}` : `Min rutine #${(next?.n ?? 0) + 1}`;
    await txn.runAsync(
      "INSERT INTO routines (id, program_id, position, name, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
      id,
      programId,
      next?.pos ?? 0,
      name,
      now,
      now,
    );
  });
  return id;
}

export async function renameRoutine(db: SQLiteDatabase, routineId: string, name: string) {
  await db.runAsync('UPDATE routines SET name = ? WHERE id = ?', name, routineId);
  await touchRoutine(db, routineId);
}

export async function deleteRoutine(db: SQLiteDatabase, routineId: string) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM routines WHERE id = ?', routineId);
    await txn.runAsync('INSERT OR IGNORE INTO pending_routine_deletions (routine_id, created_at) VALUES (?, ?)', routineId, nowIso());
  });
}

/** Hvem som kan se og laste ned en frittstående rutine. */
export async function setRoutineVisibility(db: SQLiteDatabase, routineId: string, visibility: ShareVisibility) {
  await db.runAsync('UPDATE routines SET visibility = ? WHERE id = ?', visibility, routineId);
  await touchRoutine(db, routineId);
}

export async function setRoutineFavorite(db: SQLiteDatabase, routineId: string, favorite: boolean) {
  await db.runAsync('UPDATE routines SET is_favorite = ?, favorite_dirty = 1 WHERE id = ?', favorite ? 1 : 0, routineId);
}

/** Lager en kopi av rutinen (i samme program, eller frittstående). */
export async function duplicateRoutine(db: SQLiteDatabase, routineId: string): Promise<string | null> {
  const source = await getRoutine(db, routineId);
  if (!source) return null;
  const newId = await createRoutine(db, source.programId);
  await db.withExclusiveTransactionAsync(async (txn) => {
    // Duplikatet beholder kreditten, og serveren får vite hvilken rutine det kom fra.
    await txn.runAsync(
      'UPDATE routines SET name = ?, notes = ?, visibility = ?, credit = ?, copied_from_routine_id = ? WHERE id = ?',
      `${source.name} (kopi)`.slice(0, 100),
      source.notes,
      'PRIVATE',
      creditJson(source.basedOn),
      source.basedOn ? source.id : null,
      newId,
    );
    for (const e of source.exercises) {
      const eId = uuidv7();
      await txn.runAsync(
        `INSERT INTO routine_exercises (id, routine_id, position, exercise_id, exercise_name, exercise_type, notes, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        eId, newId, e.position, e.exerciseId, e.exerciseName, e.exerciseType, e.notes, e.restSeconds,
      );
      for (const s of e.sets) {
        await txn.runAsync(
          `INSERT INTO routine_sets (id, routine_exercise_id, position, set_type, target_reps, target_weight_kg, target_duration_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          uuidv7(), eId, s.position, s.setType, s.targetReps, s.targetWeightKg, s.targetDurationSeconds,
        );
      }
    }
  });
  return newId;
}

// ---------- Øvelser i rutinen ----------

/** Standard målsett for en ny øvelse: 3 × 10 reps (eller 3 × 60 s for tidsøvelser). */
export async function addExerciseToRoutine(db: SQLiteDatabase, routineId: string, exercise: Exercise) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const pos = await txn.getFirstAsync<{ next: number }>(
      'SELECT COALESCE(MAX(position) + 1, 0) AS next FROM routine_exercises WHERE routine_id = ?',
      routineId,
    );
    const id = uuidv7();
    await txn.runAsync(
      'INSERT INTO routine_exercises (id, routine_id, position, exercise_id, exercise_name, exercise_type) VALUES (?, ?, ?, ?, ?, ?)',
      id, routineId, pos?.next ?? 0, exercise.id, exercise.name, exercise.exerciseType,
    );
    const timed = exercise.exerciseType === 'DURATION' || exercise.exerciseType === 'DISTANCE_DURATION';
    for (let i = 0; i < 3; i++) {
      await txn.runAsync(
        'INSERT INTO routine_sets (id, routine_exercise_id, position, target_reps, target_duration_seconds) VALUES (?, ?, ?, ?, ?)',
        uuidv7(), id, i, timed ? null : 10, timed ? 60 : null,
      );
    }
    await touchRoutine(txn, routineId);
  });
}

export async function removeRoutineExercise(db: SQLiteDatabase, routineExerciseId: string) {
  await touchByRoutineExercise(db, routineExerciseId);
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', routineExerciseId);
}

export async function moveRoutineExercise(db: SQLiteDatabase, routineId: string, routineExerciseId: string, direction: -1 | 1) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getAllAsync<{ id: string; position: number }>(
      'SELECT id, position FROM routine_exercises WHERE routine_id = ? ORDER BY position',
      routineId,
    );
    const i = rows.findIndex((r) => r.id === routineExerciseId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= rows.length) return;
    await txn.runAsync('UPDATE routine_exercises SET position = ? WHERE id = ?', rows[j].position, rows[i].id);
    await txn.runAsync('UPDATE routine_exercises SET position = ? WHERE id = ?', rows[i].position, rows[j].id);
    await touchRoutine(txn, routineId);
  });
}

// ---------- Målsett ----------

/** Nytt sett kopierer målene fra siste sett i øvelsen. */
export async function addRoutineSet(db: SQLiteDatabase, routineExerciseId: string) {
  const last = await db.getFirstAsync<RoutineSetRow>(
    'SELECT * FROM routine_sets WHERE routine_exercise_id = ? ORDER BY position DESC LIMIT 1',
    routineExerciseId,
  );
  await db.runAsync(
    `INSERT INTO routine_sets (id, routine_exercise_id, position, set_type, target_reps, target_weight_kg, target_duration_seconds)
     VALUES (?, ?, ?, 'NORMAL', ?, ?, ?)`,
    uuidv7(),
    routineExerciseId,
    (last?.position ?? -1) + 1,
    last?.target_reps ?? null,
    last?.target_weight_kg ?? null,
    last?.target_duration_seconds ?? null,
  );
  await touchByRoutineExercise(db, routineExerciseId);
}

export async function deleteRoutineSet(db: SQLiteDatabase, setId: string) {
  await touchBySet(db, setId);
  await db.runAsync('DELETE FROM routine_sets WHERE id = ?', setId);
}

export type RoutineSetField = 'targetReps' | 'targetWeightKg' | 'targetDurationSeconds';

const SET_COLUMNS: Record<RoutineSetField, string> = {
  targetReps: 'target_reps',
  targetWeightKg: 'target_weight_kg',
  targetDurationSeconds: 'target_duration_seconds',
};

export async function updateRoutineSetField(db: SQLiteDatabase, setId: string, field: RoutineSetField, value: number | null) {
  // Kolonnenavnet kommer fra en fast tabell, aldri fra brukerinput.
  await db.runAsync(`UPDATE routine_sets SET ${SET_COLUMNS[field]} = ? WHERE id = ?`, value, setId);
  await touchBySet(db, setId);
}

export async function setRoutineSetType(db: SQLiteDatabase, setId: string, setType: SetType) {
  await db.runAsync('UPDATE routine_sets SET set_type = ? WHERE id = ?', setType, setId);
  await touchBySet(db, setId);
}

// ---------- Synk ----------

export async function listProgramsToSync(db: SQLiteDatabase) {
  return db.getAllAsync<ProgramRow>("SELECT * FROM programs WHERE sync_status = 'pending'");
}

/** Markerer som synket bare hvis objektet ikke er endret mens opplastingen pågikk. */
export async function markProgramSynced(db: SQLiteDatabase, id: string, uploadedVersion: string) {
  await db.runAsync("UPDATE programs SET sync_status = 'synced' WHERE id = ? AND updated_at = ?", id, uploadedVersion);
}

export async function markProgramFailed(db: SQLiteDatabase, id: string, error: string) {
  await db.runAsync("UPDATE programs SET sync_status = 'failed', sync_error = ? WHERE id = ?", error, id);
}

export async function listRoutinesToSync(db: SQLiteDatabase): Promise<Routine[]> {
  return loadRoutines(db, "WHERE r.sync_status = 'pending'");
}

export async function markRoutineSynced(db: SQLiteDatabase, id: string, uploadedVersion: string) {
  await db.runAsync("UPDATE routines SET sync_status = 'synced' WHERE id = ? AND updated_at = ?", id, uploadedVersion);
}

export async function markRoutineFailed(db: SQLiteDatabase, id: string, error: string) {
  await db.runAsync("UPDATE routines SET sync_status = 'failed', sync_error = ? WHERE id = ?", error, id);
}

export async function listDirtyRoutineFavorites(db: SQLiteDatabase): Promise<{ id: string; favorite: boolean }[]> {
  const rows = await db.getAllAsync<{ id: string; is_favorite: number }>(
    "SELECT id, is_favorite FROM routines WHERE favorite_dirty = 1 AND sync_status = 'synced'",
  );
  return rows.map((r) => ({ id: r.id, favorite: r.is_favorite === 1 }));
}

export async function clearRoutineFavoriteDirty(db: SQLiteDatabase, id: string, favorite: boolean) {
  await db.runAsync('UPDATE routines SET favorite_dirty = 0 WHERE id = ? AND is_favorite = ?', id, favorite ? 1 : 0);
}

export async function listPendingProgramDeletions(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ program_id: string }>('SELECT program_id FROM pending_program_deletions');
  return rows.map((r) => r.program_id);
}

export async function clearPendingProgramDeletion(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM pending_program_deletions WHERE program_id = ?', id);
}

export async function listPendingRoutineDeletions(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ routine_id: string }>('SELECT routine_id FROM pending_routine_deletions');
  return rows.map((r) => r.routine_id);
}

export async function clearPendingRoutineDeletion(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM pending_routine_deletions WHERE routine_id = ?', id);
}

export type CoverTask = { programId: string; action: 'upload' | 'remove'; fileUri: string | null; file: string | null };

/** Bilder som skal lastes opp eller fjernes, for programmer som finnes på serveren og ikke er avvist. */
export async function listCoverTasks(db: SQLiteDatabase): Promise<CoverTask[]> {
  const rows = await db.getAllAsync<ProgramRow>(
    "SELECT * FROM programs WHERE cover_action IS NOT NULL AND cover_error IS NULL AND sync_status = 'synced'",
  );
  return rows.flatMap((r): CoverTask[] => {
    if (r.cover_action === 'remove') return [{ programId: r.id, action: 'remove', fileUri: null, file: null }];
    const uri = localCover(r.cover_file);
    return uri ? [{ programId: r.id, action: 'upload', fileUri: uri, file: r.cover_file }] : [];
  });
}

/** Bildet er lastet opp: bruk adressen på serveren og slett den lokale filen (hvis brukeren ikke har byttet bilde i mellomtiden). */
export async function markCoverUploaded(db: SQLiteDatabase, programId: string, file: string, url: string) {
  const res = await db.runAsync(
    "UPDATE programs SET cover_url = ?, cover_file = NULL, cover_action = NULL WHERE id = ? AND cover_file = ? AND cover_action = 'upload'",
    url,
    programId,
    file,
  );
  if (res.changes > 0) deleteCoverFile(file);
}

export async function markCoverRemoved(db: SQLiteDatabase, programId: string) {
  await db.runAsync("UPDATE programs SET cover_action = NULL WHERE id = ? AND cover_action = 'remove'", programId);
}

/** Serveren avviste bildet. Det prøves ikke igjen før brukeren velger et nytt. */
export async function markCoverFailed(db: SQLiteDatabase, programId: string, error: string) {
  await db.runAsync('UPDATE programs SET cover_error = ? WHERE id = ?', error, programId);
}

// ---------- Utforsk ----------

/** ID-en til den lokale kopien av et offentlig program, hvis brukeren har lastet det ned. */
export async function findDownloadedCopy(db: SQLiteDatabase, sourceProgramId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM programs WHERE source_program_id = ?', sourceProgramId);
  return row?.id ?? null;
}

/** ID-en til den lokale kopien av en delt rutine, hvis brukeren har lastet den ned. */
export async function findDownloadedRoutine(db: SQLiteDatabase, sourceRoutineId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ id: string }>('SELECT id FROM routines WHERE source_routine_id = ?', sourceRoutineId);
  return row?.id ?? null;
}

type Txn = Pick<SQLiteDatabase, 'runAsync'>;

/** Skriver en rutine fra serveren lokalt (markert som synket). Øvelser uten ID (slettet hos forfatteren) hoppes over. */
async function writeRemoteRoutine(txn: Txn, r: RemoteRoutine, programId: string | null) {
  await txn.runAsync(
    `INSERT OR REPLACE INTO routines (id, program_id, position, name, notes, visibility, source_routine_id, credit, created_at, updated_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    r.id, programId, r.position, r.name, r.notes, r.visibility ?? 'PRIVATE', r.sourceRoutineId ?? null, creditJson(r.basedOn), r.createdAt, r.updatedAt,
  );
  for (const [i, e] of r.exercises.entries()) {
    if (!e.exerciseId) continue;
    await txn.runAsync(
      `INSERT OR REPLACE INTO routine_exercises (id, routine_id, position, exercise_id, exercise_name, exercise_type, notes, rest_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      e.id, r.id, i, e.exerciseId, e.exerciseName, e.exerciseType, e.notes, e.restSeconds,
    );
    for (const [j, s] of e.sets.entries()) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO routine_sets (id, routine_exercise_id, position, set_type, target_reps, target_weight_kg, target_duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        s.id, e.id, j, s.setType, s.targetReps, s.targetWeightKg, s.targetDurationSeconds,
      );
    }
  }
}

/** Lagrer en nedlastet kopi (allerede på serveren) lokalt, markert som synket. */
export async function saveDownloadedProgram(db: SQLiteDatabase, p: RemoteProgram) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR REPLACE INTO programs (id, name, description, visibility, level, days_per_week, credit, created_at, updated_at, sync_status,
         source_program_id, cover_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
      p.id, p.name, p.description, p.visibility ?? 'PRIVATE', p.level ?? null, p.daysPerWeek ?? null, creditJson(p.basedOn),
      p.createdAt, p.updatedAt, p.sourceProgramId, p.coverUrl ?? null,
    );
    for (const r of p.routines) await writeRemoteRoutine(txn, r, p.id);
  });
}

/** Lagrer en nedlastet frittstående rutine (allerede på serveren) lokalt. */
export async function saveDownloadedRoutine(db: SQLiteDatabase, r: RemoteRoutine) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await writeRemoteRoutine(txn, r, null);
  });
}
