import { describe, expect, it } from '@jest/globals';

import {
  ageFrom,
  heaviestLift,
  muscleDistribution,
  performedExercises,
  periodStart,
  totalsSince,
  weighInDays,
  weightChange,
  weeklySeries,
} from '@/lib/profile-stats';
import type { Measurement } from '@/types/measurement';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/types/workout';

const set = (weightKg: number | null, reps: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: Math.random().toString(),
  position: 0,
  setType: 'NORMAL',
  weightKg,
  reps,
  durationSeconds: null,
  distanceM: null,
  completedAt: '2026-10-01T10:00:00Z',
  ...extra,
});

const ex = (exerciseId: string, sets: WorkoutSet[]): WorkoutExercise => ({
  supersetGroup: null,
  id: Math.random().toString(),
  position: 0,
  exerciseId,
  exerciseName: exerciseId,
  exerciseType: 'WEIGHT_REPS',
  notes: null,
  sets,
});

const catalog: Exercise[] = [
  { id: 'bench', name: 'Benk', exerciseType: 'WEIGHT_REPS', equipment: 'BARBELL', primaryMuscles: ['CHEST'], secondaryMuscles: ['TRICEPS'] },
  { id: 'dead', name: 'Mark', exerciseType: 'WEIGHT_REPS', equipment: 'BARBELL', primaryMuscles: ['LOWER_BACK', 'HAMSTRINGS'], secondaryMuscles: [] },
];

describe('weeklySeries', () => {
  it('summerer per uke og fyller tomme uker med 0', () => {
    const now = new Date(2026, 9, 22); // torsdag
    const workouts = [
      { startedAt: new Date(2026, 9, 20, 10).toISOString(), endedAt: new Date(2026, 9, 20, 11).toISOString(), exercises: [] },
      { startedAt: new Date(2026, 9, 21, 10).toISOString(), endedAt: new Date(2026, 9, 21, 10, 30).toISOString(), exercises: [] },
      { startedAt: new Date(2026, 9, 6, 10).toISOString(), endedAt: new Date(2026, 9, 6, 10, 45).toISOString(), exercises: [] },
    ];
    const series = weeklySeries(workouts, 'duration', new Date(2026, 9, 1), now);
    expect(series.map((p) => p.value)).toEqual([0, 2700, 0, 5400]);
    expect(weeklySeries(workouts, 'workouts', new Date(2026, 9, 1), now).map((p) => p.value)).toEqual([0, 1, 0, 2]);
  });
});

describe('periodStart', () => {
  it('bruker første økt for «Alle»', () => {
    const now = new Date(2026, 9, 22);
    expect(periodStart('3m', now)).toEqual(new Date(2026, 6, 22));
    expect(periodStart('all', now, new Date(2025, 0, 8).toISOString())).toEqual(new Date(2025, 0, 6));
  });
});

describe('muscleDistribution', () => {
  it('teller arbeidssett per gruppe, ikke oppvarming, og flere grupper for samme sett', () => {
    const workouts = [
      {
        startedAt: '2026-10-20T10:00:00Z',
        endedAt: '2026-10-20T11:00:00Z',
        exercises: [
          ex('bench', [set(60, 10, { setType: 'WARMUP' }), set(80, 5), set(80, 5)]),
          ex('dead', [set(100, 5), set(100, 5, { completedAt: null })]),
        ],
      },
    ];
    const result = Object.fromEntries(muscleDistribution(workouts, catalog, new Date('2026-10-01')).map((g) => [g.key, g.sets]));
    expect(result).toEqual({ BACK: 1, CHEST: 2, CORE: 0, SHOULDERS: 0, ARMS: 0, LEGS: 1 });
  });
});

describe('performedExercises', () => {
  it('gir nyeste først med beste estimerte 1RM og serie per økt', () => {
    const result = performedExercises([
      { startedAt: '2026-10-10T10:00:00Z', exercises: [ex('bench', [set(80, 5)])] },
      { startedAt: '2026-10-20T10:00:00Z', exercises: [ex('bench', [set(90, 1)]), ex('dead', [set(null, 10)])] },
      { startedAt: '2026-10-15T10:00:00Z', exercises: [ex('dead', [set(100, 5, { completedAt: null })])] },
    ]);
    expect(result.map((r) => r.exerciseId)).toEqual(['bench', 'dead']);
    expect(result[0].series.map((v) => Math.round(v * 10) / 10)).toEqual([93.3, 90]);
    expect(Math.round(result[0].best1RM! * 10) / 10).toBe(93.3);
    expect(result[1].best1RM).toBeNull();
  });
});

describe('vekt', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const m = (date: string, value: number): Measurement => ({ id: date, kind: 'WEIGHT', value, measuredAt: date });
  const entries = [m('2026-07-01T07:00:00Z', 85), m('2026-10-10T07:00:00Z', 83), m('2026-10-20T07:00:00Z', 82.4), m('2026-10-21T07:00:00Z', 82)];

  it('regner endring i vinduet, null med færre enn to målinger', () => {
    expect(weightChange(entries, 3, now)).toBe(-0.4);
    expect(weightChange(entries, 30, now)).toBe(-1);
    expect(weightChange(entries, null, now)).toBe(-3);
    expect(weightChange([entries[0]], null, now)).toBeNull();
  });

  it('markerer dager med innveiing', () => {
    const days = weighInDays(entries, 30, new Date(2026, 9, 22, 12));
    expect(days).toHaveLength(30);
    expect(days.filter(Boolean)).toHaveLength(3);
  });
});

describe('statistikk', () => {
  it('summerer siden en dato og finner tyngste løft', () => {
    const workouts = [
      { startedAt: '2025-12-30T10:00:00Z', endedAt: '2025-12-30T11:00:00Z', exercises: [ex('bench', [set(100, 1)])] },
      { startedAt: '2026-01-05T10:00:00Z', endedAt: '2026-01-05T10:30:00Z', exercises: [ex('bench', [set(120, 1, { setType: 'WARMUP' }), set(90, 3)])] },
    ];
    expect(totalsSince(workouts, new Date('2026-01-01'))).toEqual({ workouts: 1, seconds: 1800, volumeKg: 270 });
    expect(totalsSince(workouts).workouts).toBe(2);
    expect(heaviestLift(workouts, 'bench')).toBe(100);
    expect(heaviestLift(workouts, 'dead')).toBeNull();
    expect(ageFrom('1998-10-23', new Date(2026, 9, 22))).toBe(27);
    expect(ageFrom('1998-10-22', new Date(2026, 9, 22))).toBe(28);
  });
});
