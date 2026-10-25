import { estimatedOneRepMax } from '@/lib/exercise-stats';
import { computeTotals } from '@/lib/metrics';
import { startOfWeek } from '@/lib/stats';
import type { Measurement } from '@/types/measurement';
import type { Exercise, Workout } from '@/types/workout';

type Finished = Pick<Workout, 'startedAt' | 'endedAt' | 'exercises'>;

export type Period = '3m' | '6m' | '1y' | 'all';
export type Metric = 'duration' | 'volume' | 'workouts';

const DAY = 86400000;

/** Første dag i perioden. «Alle» starter ved første økt (eller 3 måneder tilbake uten historikk). */
export function periodStart(period: Period, now: Date, earliest?: string): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === '3m') d.setMonth(d.getMonth() - 3);
  else if (period === '6m') d.setMonth(d.getMonth() - 6);
  else if (period === '1y') d.setFullYear(d.getFullYear() - 1);
  else if (earliest) return startOfWeek(new Date(earliest));
  else d.setMonth(d.getMonth() - 3);
  return d;
}

function metricValue(w: Finished, metric: Metric): number {
  if (metric === 'workouts') return 1;
  if (metric === 'volume') return computeTotals(w.exercises).volumeKg;
  return Math.max(0, (new Date(w.endedAt ?? w.startedAt).getTime() - new Date(w.startedAt).getTime()) / 1000);
}

export type WeekPoint = { date: string; value: number };

/** Sum per uke (mandag–søndag) fra uken `from` ligger i til og med denne uken. Uker uten økter gir 0. */
export function weeklySeries(workouts: Finished[], metric: Metric, from: Date, now: Date = new Date()): WeekPoint[] {
  const sums = new Map<number, number>();
  for (const w of workouts) {
    const key = startOfWeek(new Date(w.startedAt)).getTime();
    sums.set(key, (sums.get(key) ?? 0) + metricValue(w, metric));
  }
  const out: WeekPoint[] = [];
  const cursor = startOfWeek(from);
  const last = startOfWeek(now).getTime();
  while (cursor.getTime() <= last) {
    out.push({ date: cursor.toISOString(), value: sums.get(cursor.getTime()) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

/** Grupper i muskelfordelingen (radardiagrammet), med musklene som hører til. */
export const RADAR_GROUPS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'BACK', label: 'Rygg', muscles: ['LATS', 'UPPER_BACK', 'LOWER_BACK', 'TRAPS'] },
  { key: 'CHEST', label: 'Bryst', muscles: ['CHEST'] },
  { key: 'CORE', label: 'Kjerne', muscles: ['ABS', 'OBLIQUES'] },
  { key: 'SHOULDERS', label: 'Skuldre', muscles: ['SHOULDERS'] },
  { key: 'ARMS', label: 'Armer', muscles: ['BICEPS', 'TRICEPS', 'FOREARMS'] },
  { key: 'LEGS', label: 'Bein', muscles: ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'ADDUCTORS', 'ABDUCTORS'] },
];

export type GroupTotals = { key: string; label: string; sets: number; volumeKg: number };

/**
 * Fullførte arbeidssett (ikke oppvarming) og volum per muskelgruppe, ut fra øvelsens primærmuskler.
 * Et sett i en øvelse som treffer flere grupper (f.eks. markløft: rygg og bein) teller i hver av dem.
 */
export function muscleDistribution(workouts: Finished[], catalog: Exercise[], from: Date): GroupTotals[] {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const totals = RADAR_GROUPS.map((g) => ({ key: g.key, label: g.label, sets: 0, volumeKg: 0 }));
  for (const w of workouts) {
    if (new Date(w.startedAt).getTime() < from.getTime()) continue;
    for (const we of w.exercises) {
      const ex = byId.get(we.exerciseId);
      if (!ex) continue;
      const groups = RADAR_GROUPS.map((g, i) => (g.muscles.some((m) => ex.primaryMuscles.includes(m)) ? i : -1)).filter((i) => i >= 0);
      for (const s of we.sets) {
        if (!s.completedAt || s.setType === 'WARMUP') continue;
        const vol = (s.weightKg ?? 0) * (s.reps ?? 0);
        for (const i of groups) {
          totals[i].sets += 1;
          totals[i].volumeKg += vol;
        }
      }
    }
  }
  return totals;
}

export type PerformedExercise = {
  exerciseId: string;
  name: string;
  lastPerformed: string;
  /** Høyeste estimerte 1RM (Epley, 1–12 reps). Null for øvelser uten vekt × reps. */
  best1RM: number | null;
  /** Beste estimerte 1RM per økt, eldst først (til minigrafen). */
  series: number[];
  workoutCount: number;
};

/** Alle øvelser brukeren har fullført minst ett sett i, nyeste først. */
export function performedExercises(workouts: Pick<Workout, 'startedAt' | 'exercises'>[]): PerformedExercise[] {
  const sorted = [...workouts].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const map = new Map<string, PerformedExercise>();
  for (const w of sorted) {
    for (const we of w.exercises) {
      const done = we.sets.filter((s) => s.completedAt && s.setType !== 'WARMUP');
      if (done.length === 0) continue;
      let entry = map.get(we.exerciseId);
      if (!entry) {
        entry = { exerciseId: we.exerciseId, name: we.exerciseName, lastPerformed: w.startedAt, best1RM: null, series: [], workoutCount: 0 };
        map.set(we.exerciseId, entry);
      }
      entry.name = we.exerciseName;
      entry.lastPerformed = w.startedAt;
      entry.workoutCount += 1;
      let best: number | null = null;
      for (const s of done) {
        if (s.weightKg === null || s.reps === null) continue;
        const e = estimatedOneRepMax(s.weightKg, s.reps);
        if (e !== null && (best === null || e > best)) best = e;
      }
      if (best !== null) {
        entry.series.push(best);
        entry.best1RM = Math.max(entry.best1RM ?? 0, best);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.lastPerformed.localeCompare(a.lastPerformed));
}

/** Siste registrerte verdi (målinger sortert vilkårlig). */
export function latest(entries: Measurement[]): Measurement | null {
  return entries.reduce<Measurement | null>((best, m) => (!best || m.measuredAt > best.measuredAt ? m : best), null);
}

export const CHANGE_WINDOWS = [3, 7, 14, 30, 90] as const;

/**
 * Vektendring over de siste `days` dagene: siste måling minus den eldste målingen i vinduet.
 * Null når det er færre enn to målinger i vinduet. `days` = null betyr hele perioden.
 */
export function weightChange(entries: Measurement[], days: number | null, now: Date = new Date()): number | null {
  const from = days === null ? -Infinity : now.getTime() - days * DAY;
  const inWindow = entries
    .filter((m) => new Date(m.measuredAt).getTime() >= from && new Date(m.measuredAt).getTime() <= now.getTime())
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  if (inWindow.length < 2) return null;
  return Math.round((inWindow[inWindow.length - 1].value - inWindow[0].value) * 100) / 100;
}

/** Hvilke av de siste `days` dagene (eldst først, i dag sist) som har en innveiing. */
export function weighInDays(entries: Measurement[], days = 30, now: Date = new Date()): boolean[] {
  const keys = new Set(entries.map((m) => new Date(m.measuredAt).toDateString()));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
    return keys.has(d.toDateString());
  });
}

export type Totals = { workouts: number; seconds: number; volumeKg: number };

/** Antall økter, samlet tid og volum for økter startet fra og med `from` (eller alle). */
export function totalsSince(workouts: Finished[], from?: Date): Totals {
  const out: Totals = { workouts: 0, seconds: 0, volumeKg: 0 };
  for (const w of workouts) {
    if (from && new Date(w.startedAt).getTime() < from.getTime()) continue;
    out.workouts += 1;
    out.seconds += metricValue(w, 'duration');
    out.volumeKg += metricValue(w, 'volume');
  }
  return out;
}

/** Tyngste fullførte arbeidssett (ikke oppvarming) i en øvelse, eller null hvis den aldri er løftet med vekt. */
export function heaviestLift(workouts: Pick<Workout, 'exercises'>[], exerciseId: string): number | null {
  let best: number | null = null;
  for (const w of workouts) {
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) {
        if (!s.completedAt || s.setType === 'WARMUP' || s.weightKg === null || s.weightKg <= 0) continue;
        if (best === null || s.weightKg > best) best = s.weightKg;
      }
    }
  }
  return best;
}

/** Hele år mellom fødselsdato (ÅÅÅÅ-MM-DD) og i dag. */
export function ageFrom(birthDate: string, now: Date = new Date()): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}
