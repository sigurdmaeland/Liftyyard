import type { Workout } from '@/types/workout';

import { computeTotals } from '@/lib/metrics';
import { type Medal, bestMedals, setRecordsByWorkout } from '@/lib/records';

/** Mandag 00:00 lokal tid i uken `date` tilhører (norsk/ISO-uke). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // mandag = 0
  d.setDate(d.getDate() - day);
  return d;
}

export type WeekTotals = { workouts: number; seconds: number; volumeKg: number };

type Finished = Pick<Workout, 'startedAt' | 'endedAt' | 'exercises'>;

function totalsBetween(workouts: Finished[], from: Date, to: Date): WeekTotals {
  const out: WeekTotals = { workouts: 0, seconds: 0, volumeKg: 0 };
  for (const w of workouts) {
    const t = new Date(w.startedAt).getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    out.workouts += 1;
    out.seconds += Math.max(0, (new Date(w.endedAt ?? w.startedAt).getTime() - t) / 1000);
    out.volumeKg += computeTotals(w.exercises).volumeKg;
  }
  return out;
}

/** Denne uken og forrige uke, for sammendraget på Hjem. */
export function weeklySummary(workouts: Finished[], now: Date = new Date()) {
  const thisWeek = startOfWeek(now);
  const nextWeek = new Date(thisWeek);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  return {
    current: totalsBetween(workouts, thisWeek, nextWeek),
    previous: totalsBetween(workouts, lastWeek, thisWeek),
  };
}

/**
 * Ukesrekke: antall sammenhengende uker med minst én økt, regnet bakover fra denne uken.
 * Hvis denne uken ikke har økter ennå, telles rekken fra forrige uke, slik at den ikke brytes før uken er over.
 */
export function weekStreak(workouts: Pick<Workout, 'startedAt'>[], now: Date = new Date()): number {
  const weeks = new Set(workouts.map((w) => startOfWeek(new Date(w.startedAt)).getTime()));
  const cursor = startOfWeek(now);
  if (!weeks.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

/**
 * Rekorder: en øvelse gir rekord i en økt når tyngste fullførte arbeidssett (ikke oppvarming) er
 * tyngre enn alt brukeren har løftet i øvelsen før. Første gang en øvelse logges teller ikke.
 * Returnerer øvelses-ID-ene med rekord per økt.
 */
export function recordExercisesPerWorkout(workouts: (Finished & Pick<Workout, 'id'>)[]): Map<string, Set<string>> {
  const bySet = setRecordsByWorkout(workouts);
  const result = new Map<string, Set<string>>();
  for (const w of workouts) {
    const records = bySet.get(w.id) ?? new Map();
    result.set(w.id, new Set(w.exercises.filter((e) => e.sets.some((s) => records.has(s.id))).map((e) => e.exerciseId)));
  }
  return result;
}

/** Antall rekorder (medaljer) per økt. Se lib/records.ts. */
export function recordsPerWorkout(workouts: (Finished & Pick<Workout, 'id'>)[]): Map<string, number> {
  const bySet = setRecordsByWorkout(workouts);
  return new Map([...bySet].map(([id, sets]) => [id, [...sets.values()].reduce((n, list) => n + list.length, 0)]));
}

export type RecordSummaryValue = { count: number; medals: Medal[] };

/** Antall rekorder og hvilke medaljer (gull/sølv/bronse) hver økt har, for kortene i feeden. */
export function recordSummaryPerWorkout(workouts: (Finished & Pick<Workout, 'id'>)[]): Map<string, RecordSummaryValue> {
  const bySet = setRecordsByWorkout(workouts);
  return new Map(
    [...bySet].map(([id, sets]) => {
      const lists = [...sets.values()];
      return [id, { count: lists.reduce((n, l) => n + l.length, 0), medals: bestMedals(lists) }];
    }),
  );
}

/** «45m», «1t 5m». */
export function formatShortDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}t ${m}m` : `${m}m`;
}

/** «I dag kl. 14:44», «I går kl. 16:58», «19. oktober kl. 15:03». */
export function formatRelativeDateTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
  const dayDiff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  );
  if (dayDiff === 0) return `I dag kl. ${time}`;
  if (dayDiff === 1) return `I går kl. ${time}`;
  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  return `${date} kl. ${time}`;
}
