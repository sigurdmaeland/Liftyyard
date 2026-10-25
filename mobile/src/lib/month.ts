import { computeTotals } from '@/lib/metrics';
import { recordsPerWorkout } from '@/lib/stats';
import type { Workout } from '@/types/workout';

export type MonthSummary = {
  year: number;
  /** 0–11. */
  month: number;
  workouts: number;
  seconds: number;
  volumeKg: number;
  sets: number;
  records: number;
  /** Antall ulike dager med trening. */
  activeDays: number;
  /** Øvelsene brukt i flest økter, flest først (maks 5). */
  topExercises: { name: string; workouts: number }[];
};

/** Oppsummering av én måned, ut fra fullførte økter (rekorder regnes mot hele historikken). */
export function monthSummary(all: Workout[], year: number, month: number): MonthSummary {
  const inMonth = all.filter((w) => {
    const d = new Date(w.startedAt);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const records = recordsPerWorkout(all);
  const days = new Set(inMonth.map((w) => new Date(w.startedAt).toDateString()));
  const byExercise = new Map<string, number>();
  let seconds = 0;
  let volumeKg = 0;
  let sets = 0;
  let recordCount = 0;
  for (const w of inMonth) {
    const t = computeTotals(w.exercises);
    volumeKg += t.volumeKg;
    sets += t.completedSetCount;
    seconds += Math.max(0, (new Date(w.endedAt ?? w.startedAt).getTime() - new Date(w.startedAt).getTime()) / 1000);
    recordCount += records.get(w.id) ?? 0;
    for (const name of new Set(w.exercises.filter((e) => e.sets.some((s) => s.completedAt)).map((e) => e.exerciseName))) {
      byExercise.set(name, (byExercise.get(name) ?? 0) + 1);
    }
  }
  const topExercises = [...byExercise]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'))
    .slice(0, 5)
    .map(([name, workouts]) => ({ name, workouts }));
  return { year, month, workouts: inMonth.length, seconds, volumeKg, sets, records: recordCount, activeDays: days.size, topExercises };
}

export function monthName(year: number, month: number): string {
  const name = new Date(year, month, 1).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
}
