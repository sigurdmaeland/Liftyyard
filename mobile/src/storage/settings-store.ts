import type { SQLiteDatabase } from 'expo-sqlite';

import { type WeightUnit, setWeightUnitInMemory } from '@/lib/units';

/*
 * Brukerinnstillinger som synkes til serveren (PUT /api/settings): vektmål, ukesmål og
 * vektenhet. Lagres som nøkkel/verdi i user_settings; dirty = endret her, ikke sendt ennå.
 */
const GOAL_WEIGHT = 'goal_weight_kg';
const WEEKLY_GOAL = 'weekly_goal';
const WEIGHT_UNIT = 'weight_unit';
const KEYS = [GOAL_WEIGHT, WEEKLY_GOAL, WEIGHT_UNIT];

export type Settings = { goalWeightKg: number | null; weeklyWorkoutGoal: number | null; weightUnit: WeightUnit };

async function readAll(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ key: string; value: string | null; dirty: number }>(
    `SELECT key, value, dirty FROM user_settings WHERE key IN (?, ?, ?)`,
    ...KEYS,
  );
  return new Map(rows.map((r) => [r.key, r]));
}

function toSettings(m: Map<string, { value: string | null }>): Settings {
  const goal = m.get(GOAL_WEIGHT)?.value;
  const weekly = m.get(WEEKLY_GOAL)?.value;
  return {
    goalWeightKg: goal ? Number(goal) : null,
    weeklyWorkoutGoal: weekly ? Number(weekly) : null,
    weightUnit: m.get(WEIGHT_UNIT)?.value === 'LB' ? 'LB' : 'KG',
  };
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const s = toSettings(await readAll(db));
  setWeightUnitInMemory(s.weightUnit);
  return s;
}

async function write(db: SQLiteDatabase, key: string, value: string | null, dirty: boolean) {
  await db.runAsync(
    `INSERT INTO user_settings (key, value, dirty) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, dirty = excluded.dirty`,
    key,
    value,
    dirty ? 1 : 0,
  );
}

export async function setWeeklyGoal(db: SQLiteDatabase, workouts: number | null) {
  await write(db, WEEKLY_GOAL, workouts === null ? null : String(workouts), true);
}

export async function setWeightUnit(db: SQLiteDatabase, unit: WeightUnit) {
  await write(db, WEIGHT_UNIT, unit, true);
  setWeightUnitInMemory(unit);
}

/** Innstillingene hvis noen av dem er endret lokalt, med `raw` for trygg fjerning av flagget. */
export async function getDirtySettings(db: SQLiteDatabase): Promise<{ settings: Settings; raw: Map<string, string | null> } | null> {
  const m = await readAll(db);
  if (![...m.values()].some((r) => r.dirty === 1)) return null;
  return { settings: toSettings(m), raw: new Map([...m].map(([k, r]) => [k, r.value])) };
}

/** Fjerner dirty-flagget for verdier som ikke er endret igjen mens opplastingen pågikk. */
export async function clearSettingsDirty(db: SQLiteDatabase, raw: Map<string, string | null>) {
  for (const [key, value] of raw) {
    await db.runAsync('UPDATE user_settings SET dirty = 0 WHERE key = ? AND value IS ?', key, value);
  }
}

/** Innstillingene slik serveren har dem (ved innlogging). Overstyrer ikke lokale endringer som venter. */
export async function setSettingsFromServer(db: SQLiteDatabase, s: Partial<Settings>) {
  const m = await readAll(db);
  const put = async (key: string, value: string | null) => {
    if (m.get(key)?.dirty === 1) return;
    await write(db, key, value, false);
  };
  await put(GOAL_WEIGHT, s.goalWeightKg == null ? null : String(s.goalWeightKg));
  await put(WEEKLY_GOAL, s.weeklyWorkoutGoal == null ? null : String(s.weeklyWorkoutGoal));
  await put(WEIGHT_UNIT, s.weightUnit === 'LB' ? 'LB' : 'KG');
  await getSettings(db);
}
