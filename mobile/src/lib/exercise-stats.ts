import type { Exercise, WorkoutSet } from '@/types/workout';

type Entry = { workoutId: string; startedAt: string; sets: WorkoutSet[] };

const working = (s: WorkoutSet) => s.completedAt !== null && s.setType !== 'WARMUP';

/**
 * Estimert 1RM med Epleys formel: vekt × (1 + reps / 30). Bare for sett med 1–12 reps, der
 * formelen er rimelig presis. Dette er et estimat, ikke et målt løft, og vises alltid som det.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > 12) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

export type Record = { value: number; reps?: number; weightKg?: number; date: string; workoutId: string };

export type ExerciseRecords = {
  heaviest: Record | null;
  bestSetVolume: Record | null;
  mostReps: Record | null;
  estimated1RM: Record | null;
};

/** Personlige rekorder fra fullførte arbeidssett (oppvarming teller ikke). */
export function exerciseRecords(history: Entry[]): ExerciseRecords {
  const out: ExerciseRecords = { heaviest: null, bestSetVolume: null, mostReps: null, estimated1RM: null };
  const better = (current: Record | null, value: number) => current === null || value > current.value;
  for (const h of history) {
    for (const s of h.sets.filter(working)) {
      const base = { date: h.startedAt, workoutId: h.workoutId, reps: s.reps ?? undefined, weightKg: s.weightKg ?? undefined };
      if (s.weightKg !== null && s.weightKg > 0 && better(out.heaviest, s.weightKg)) out.heaviest = { ...base, value: s.weightKg };
      if (s.reps !== null && better(out.mostReps, s.reps)) out.mostReps = { ...base, value: s.reps };
      if (s.weightKg !== null && s.reps !== null) {
        const vol = s.weightKg * s.reps;
        if (vol > 0 && better(out.bestSetVolume, vol)) out.bestSetVolume = { ...base, value: vol };
        const e1rm = estimatedOneRepMax(s.weightKg, s.reps);
        if (e1rm !== null && better(out.estimated1RM, e1rm)) out.estimated1RM = { ...base, value: e1rm };
      }
    }
  }
  return out;
}

export type ProgressPoint = { date: string; value: number };

/** Tyngste arbeidssett per økt, eldst først (til Fremgang-grafen). */
export function heaviestPerWorkout(history: Entry[]): ProgressPoint[] {
  return history
    .map((h) => {
      const weights = h.sets.filter(working).map((s) => s.weightKg ?? 0);
      return { date: h.startedAt, value: Math.max(0, ...weights) };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Beste estimerte 1RM per økt, eldst først. */
export function bestOneRepMaxPerWorkout(history: Entry[]): ProgressPoint[] {
  return history
    .map((h) => ({
      date: h.startedAt,
      value: Math.max(0, ...h.sets.filter(working).map((s) => estimatedOneRepMax(s.weightKg ?? 0, s.reps ?? 0) ?? 0)),
    }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Totalt volum (vekt × reps) for øvelsen per økt, eldst først. */
export function volumePerWorkout(history: Entry[]): ProgressPoint[] {
  return history
    .map((h) => ({ date: h.startedAt, value: h.sets.filter(working).reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Alternative øvelser: andre øvelser som deler primærmuskler. Sortert etter hvor mange
 * primærmuskler de deler, deretter sekundære, deretter navn. Maks `limit`.
 */
export function alternatives(target: Exercise, all: Exercise[], limit = 10): Exercise[] {
  const primary = new Set(target.primaryMuscles);
  const secondary = new Set(target.secondaryMuscles);
  return all
    .filter((e) => e.id !== target.id)
    .map((e) => ({
      e,
      p: e.primaryMuscles.filter((m) => primary.has(m)).length,
      s: e.secondaryMuscles.filter((m) => secondary.has(m) || primary.has(m)).length,
    }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || b.s - a.s || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}
