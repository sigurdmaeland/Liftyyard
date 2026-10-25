import type { SetType } from '@/types/workout';

/*
 * Rekorder per sett, slik de vises med medaljer på økter: estimert 1RM, tyngste vekt og største
 * settvolum (vekt × reps) for hver øvelse. Et sett får medalje når verdien er ny og blant de tre
 * beste noen gang for øvelsen (gull, sølv, bronse). Første gang en øvelse logges gir ingen
 * medaljer – da finnes det ingenting å slå.
 */

export type RecordKind = 'E1RM' | 'WEIGHT' | 'VOLUME';
export type Medal = 1 | 2 | 3;
export type SetRecord = { kind: RecordKind; medal: Medal };

export const RECORD_LABELS: Record<RecordKind, string> = { E1RM: '1RM', WEIGHT: 'Vekt', VOLUME: 'Volum' };
export const RECORD_DESCRIPTIONS: Record<RecordKind, string> = {
  E1RM: 'estimert 1RM',
  WEIGHT: 'tyngste vekt',
  VOLUME: 'største settvolum',
};
export const MEDAL_NAMES: Record<Medal, string> = { 1: 'gull', 2: 'sølv', 3: 'bronse' };

const KINDS: RecordKind[] = ['E1RM', 'WEIGHT', 'VOLUME'];

/** Estimert 1RM etter Epleys formel (vekt × (1 + reps/30)). null for sett uten vekt eller reps. */
export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null || weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

type RecordSet = { id: string; setType: SetType; weightKg: number | null; reps: number | null; completedAt: string | null };
type RecordWorkout = { id: string; startedAt: string; exercises: { exerciseId: string | null; sets: RecordSet[] }[] };

function valuesOf(s: RecordSet): Record<RecordKind, number> | null {
  if (!s.completedAt || s.setType === 'WARMUP') return null;
  const e1rm = estimateOneRepMax(s.weightKg, s.reps);
  if (e1rm === null) return null;
  return { E1RM: e1rm, WEIGHT: s.weightKg!, VOLUME: s.weightKg! * s.reps! };
}

/** Medaljer per sett for alle økter: økt-ID → sett-ID → rekorder. */
export function setRecordsByWorkout(workouts: RecordWorkout[]): Map<string, Map<string, SetRecord[]>> {
  const sorted = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  // Per øvelse og type: verdiene som er sett før (de tre beste holder for å rangere).
  const seen = new Map<string, Record<RecordKind, number[]>>();
  const result = new Map<string, Map<string, SetRecord[]>>();
  for (const w of sorted) {
    const records = new Map<string, SetRecord[]>();
    const loggedNow = new Set<string>();
    for (const e of w.exercises) {
      if (!e.exerciseId) continue;
      const hasHistory = seen.has(e.exerciseId) && !loggedNow.has(e.exerciseId);
      const best = seen.get(e.exerciseId) ?? { E1RM: [], WEIGHT: [], VOLUME: [] };
      for (const s of e.sets) {
        const v = valuesOf(s);
        if (!v) continue;
        const found: SetRecord[] = [];
        for (const kind of KINDS) {
          const value = v[kind];
          const previous = best[kind];
          const isNew = !previous.some((p) => Math.abs(p - value) < 1e-9);
          const rank = 1 + previous.filter((p) => p > value + 1e-9).length;
          if (hasHistory && isNew && rank <= 3) found.push({ kind, medal: rank as Medal });
          if (isNew) best[kind] = [...previous, value].sort((a, b) => b - a).slice(0, 3);
        }
        if (found.length > 0) records.set(s.id, found);
      }
      if (!seen.has(e.exerciseId)) {
        seen.set(e.exerciseId, best);
        loggedNow.add(e.exerciseId);
      }
    }
    result.set(w.id, records);
  }
  return result;
}

/** Beste (laveste) medalje blant rekordene, for å velge ikonfarge. */
export function bestMedals(records: Iterable<SetRecord[]>): Medal[] {
  const medals = new Set<Medal>();
  for (const list of records) for (const r of list) medals.add(r.medal);
  return [...medals].sort();
}
