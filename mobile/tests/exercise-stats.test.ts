import { describe, expect, it } from '@jest/globals';

import { alternatives, estimatedOneRepMax, exerciseRecords, heaviestPerWorkout } from '@/lib/exercise-stats';
import type { Exercise, WorkoutSet } from '@/types/workout';

const set = (weightKg: number | null, reps: number | null, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's', position: 0, setType: 'NORMAL', weightKg, reps, durationSeconds: null, distanceM: null,
  completedAt: '2026-10-01T10:00:00Z', ...extra,
});

describe('estimatedOneRepMax', () => {
  it('bruker Epley og avgrenser reps', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimatedOneRepMax(100, 20)).toBeNull();
  });
});

describe('exerciseRecords', () => {
  it('finner rekorder og ignorerer oppvarming', () => {
    const r = exerciseRecords([
      { workoutId: 'a', startedAt: '2026-10-01T10:00:00Z', sets: [set(100, 5), set(140, 1, { setType: 'WARMUP' })] },
      { workoutId: 'b', startedAt: '2026-10-05T10:00:00Z', sets: [set(110, 3), set(60, 15)] },
    ]);
    expect(r.heaviest?.value).toBe(110);
    expect(r.mostReps?.value).toBe(15);
    expect(r.bestSetVolume?.value).toBe(900);
    expect(r.estimated1RM?.value).toBeCloseTo(121, 0);
  });
});

describe('heaviestPerWorkout', () => {
  it('gir ett punkt per økt, eldst først', () => {
    const points = heaviestPerWorkout([
      { workoutId: 'b', startedAt: '2026-10-05T10:00:00Z', sets: [set(110, 3)] },
      { workoutId: 'a', startedAt: '2026-10-01T10:00:00Z', sets: [set(100, 5), set(90, 8)] },
    ]);
    expect(points).toEqual([
      { date: '2026-10-01T10:00:00Z', value: 100 },
      { date: '2026-10-05T10:00:00Z', value: 110 },
    ]);
  });
});

describe('alternatives', () => {
  const ex = (id: string, p: string[], s: string[] = []): Exercise => ({
    id, name: id, exerciseType: 'WEIGHT_REPS', equipment: 'BARBELL', primaryMuscles: p, secondaryMuscles: s,
  });
  it('sorterer etter delte primærmuskler', () => {
    const deadlift = ex('deadlift', ['HAMSTRINGS', 'GLUTES', 'LOWER_BACK']);
    const result = alternatives(deadlift, [
      deadlift,
      ex('rdl', ['HAMSTRINGS', 'GLUTES'], ['LOWER_BACK']),
      ex('curl', ['HAMSTRINGS']),
      ex('bench', ['CHEST']),
    ]);
    expect(result.map((e) => e.id)).toEqual(['rdl', 'curl']);
  });
});
