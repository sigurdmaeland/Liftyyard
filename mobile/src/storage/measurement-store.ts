import type { SQLiteDatabase } from 'expo-sqlite';

import { uuidv7 } from '@/lib/ids';
import type { Measurement, MeasurementKind } from '@/types/measurement';

/*
 * Kroppsmålinger lagres lokalt med en gang og synkes til serveren når det er nett,
 * på samme måte som økter. En sletting legges i kø, slik at den også når serveren.
 */

type Row = { id: string; kind: MeasurementKind; value: number; measured_at: string; updated_at: string };

const nowIso = () => new Date().toISOString();
const toMeasurement = (r: Row): Measurement => ({ id: r.id, kind: r.kind, value: r.value, measuredAt: r.measured_at });

export async function addMeasurement(db: SQLiteDatabase, kind: MeasurementKind, value: number, measuredAt: string): Promise<string> {
  const id = uuidv7();
  await db.runAsync(
    `INSERT INTO body_measurements (id, kind, value, measured_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    id,
    kind,
    value,
    measuredAt,
    nowIso(),
  );
  return id;
}

/** Alle målinger, eller bare én type, eldst først. */
export async function listMeasurements(db: SQLiteDatabase, kind?: MeasurementKind): Promise<Measurement[]> {
  const rows = kind
    ? await db.getAllAsync<Row>('SELECT * FROM body_measurements WHERE kind = ? ORDER BY measured_at', kind)
    : await db.getAllAsync<Row>('SELECT * FROM body_measurements ORDER BY measured_at');
  return rows.map(toMeasurement);
}

export async function deleteMeasurement(db: SQLiteDatabase, id: string) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM body_measurements WHERE id = ?', id);
    await txn.runAsync('INSERT OR IGNORE INTO pending_measurement_deletions (measurement_id, created_at) VALUES (?, ?)', id, nowIso());
  });
}

// ---------- Vektmål ----------

const GOAL_KEY = 'goal_weight_kg';

export async function getGoalWeight(db: SQLiteDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ?', GOAL_KEY);
  return row?.value ? Number(row.value) : null;
}

/** null fjerner målet. */
export async function setGoalWeight(db: SQLiteDatabase, kg: number | null) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, 1)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, dirty = 1`,
    GOAL_KEY,
    kg === null ? null : String(kg),
  );
}

// ---------- Synk ----------

export async function listMeasurementsToSync(db: SQLiteDatabase): Promise<(Measurement & { updatedAt: string })[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM body_measurements WHERE sync_status = 'pending' ORDER BY measured_at");
  return rows.map((r) => ({ ...toMeasurement(r), updatedAt: r.updated_at }));
}

/** Markerer som synket bare hvis målingen ikke er endret mens opplastingen pågikk. */
export async function markMeasurementSynced(db: SQLiteDatabase, id: string, updatedAt: string) {
  await db.runAsync("UPDATE body_measurements SET sync_status = 'synced', sync_error = NULL WHERE id = ? AND updated_at = ?", id, updatedAt);
}

export async function markMeasurementFailed(db: SQLiteDatabase, id: string, error: string) {
  await db.runAsync("UPDATE body_measurements SET sync_status = 'failed', sync_error = ? WHERE id = ?", error, id);
}

export async function listPendingMeasurementDeletions(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ measurement_id: string }>('SELECT measurement_id FROM pending_measurement_deletions ORDER BY created_at');
  return rows.map((r) => r.measurement_id);
}

export async function clearPendingMeasurementDeletion(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM pending_measurement_deletions WHERE measurement_id = ?', id);
}

/** Vektmålet hvis det er endret lokalt og ikke sendt ennå. */
export async function getDirtyGoalWeight(db: SQLiteDatabase): Promise<{ value: number | null } | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM user_settings WHERE key = ? AND dirty = 1', GOAL_KEY);
  return row ? { value: row.value ? Number(row.value) : null } : null;
}

/** Fjerner dirty-flagget bare hvis verdien ikke er endret igjen i mellomtiden. */
export async function clearGoalWeightDirty(db: SQLiteDatabase, sent: number | null) {
  await db.runAsync(
    'UPDATE user_settings SET dirty = 0 WHERE key = ? AND value IS ?',
    GOAL_KEY,
    sent === null ? null : String(sent),
  );
}

/** Vektmålet slik serveren har det. Merkes ikke som endret. */
export async function setGoalWeightFromServer(db: SQLiteDatabase, kg: number | null) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, 0)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, dirty = 0`,
    GOAL_KEY,
    kg === null ? null : String(kg),
  );
}
