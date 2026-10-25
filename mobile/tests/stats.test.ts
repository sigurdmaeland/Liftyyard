import { describe, expect, it } from '@jest/globals';

import { formatShortDuration, recordsPerWorkout, startOfWeek, weekStreak, weeklySummary } from '@/lib/stats';
import type { Workout, WorkoutSet } from '@/types/workout';

let n = 0;
const set = (weightKg: number, reps = 5, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s${n++}`, position: 0, setType: 'NORMAL', weightKg, reps, durationSeconds: null, distanceM: null,
  completedAt: '2026-10-01T10:00:00Z', ...extra,
});

const workout = (id: string, startedAt: string, minutes: number, sets: WorkoutSet[], exerciseId = 'bench'): Workout => ({
  id, name: id, description: null, notes: null, perceivedEffort: null, sourceRoutineId: null, visibility: 'FOLLOWERS', startedAt,
  endedAt: new Date(new Date(startedAt).getTime() + minutes * 60000).toISOString(),
  status: 'finished', syncStatus: 'synced', syncError: null,
  exercises: [{ id: `${id}-e`, position: 0, exerciseId, exerciseName: exerciseId, exerciseType: 'WEIGHT_REPS', notes: null, supersetGroup: null, sets }],
});

describe('startOfWeek', () => {
  it('starter på mandag', () => {
    const monday = startOfWeek(new Date(2026, 9, 21, 15)); // onsdag 21. okt
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(19);
    expect(startOfWeek(new Date(2026, 9, 25)).getDate()).toBe(19); // søndag hører til samme uke
  });
});

describe('weeklySummary', () => {
  it('summerer denne og forrige uke', () => {
    const now = new Date(2026, 9, 21, 12);
    const ws = [
      workout('a', new Date(2026, 9, 20, 10).toISOString(), 60, [set(100, 5)]),
      workout('b', new Date(2026, 9, 13, 10).toISOString(), 30, [set(50, 10)]),
    ];
    const s = weeklySummary(ws, now);
    expect(s.current).toEqual({ workouts: 1, seconds: 3600, volumeKg: 500 });
    expect(s.previous).toEqual({ workouts: 1, seconds: 1800, volumeKg: 500 });
  });
});

describe('weekStreak', () => {
  const now = new Date(2026, 9, 21, 12);
  it('teller sammenhengende uker', () => {
    const ws = [new Date(2026, 9, 20), new Date(2026, 9, 14), new Date(2026, 9, 6)].map((d) => ({ startedAt: d.toISOString() }));
    expect(weekStreak(ws, now)).toBe(3);
  });
  it('brytes ikke før uken er over', () => {
    expect(weekStreak([{ startedAt: new Date(2026, 9, 14).toISOString() }], now)).toBe(1);
  });
  it('er 0 uten økter', () => {
    expect(weekStreak([], now)).toBe(0);
  });
});

describe('recordsPerWorkout', () => {
  it('teller bare når tidligere beste slås', () => {
    const r = recordsPerWorkout([
      workout('first', '2026-10-01T10:00:00Z', 30, [set(80)]),
      workout('same', '2026-10-03T10:00:00Z', 30, [set(80)]),
      workout('pr', '2026-10-05T10:00:00Z', 30, [set(85), set(120, 3, { setType: 'WARMUP' })]),
    ]);
    expect(r.get('first')).toBe(0);
    expect(r.get('same')).toBe(0);
    // 85 × 5 slår både 1RM, vekt og volum.
    expect(r.get('pr')).toBe(3);
  });
});

describe('formatShortDuration', () => {
  it('formaterer', () => {
    expect(formatShortDuration(300)).toBe('5m');
    expect(formatShortDuration(3900)).toBe('1t 5m');
  });
});
