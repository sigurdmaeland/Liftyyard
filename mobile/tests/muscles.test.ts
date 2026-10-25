import { describe, expect, it } from '@jest/globals';

import { muscleLoad } from '@/lib/muscles';
import type { Exercise, WorkoutSet } from '@/types/workout';

const done = { completedAt: '2026-10-01T10:00:00Z' } as WorkoutSet;
const notDone = { completedAt: null } as WorkoutSet;
const ex = (id: string, primary: string[], secondary: string[]): Exercise => ({
  id, name: id, exerciseType: 'WEIGHT_REPS', equipment: 'BARBELL', primaryMuscles: primary, secondaryMuscles: secondary,
});

describe('muscleLoad', () => {
  it('primær vinner over sekundær, og ufullførte øvelser ignoreres', () => {
    const load = muscleLoad(
      [
        { exerciseId: 'bench', sets: [done] },
        { exerciseId: 'dip', sets: [done] },
        { exerciseId: 'squat', sets: [notDone] },
      ],
      [ex('bench', ['CHEST'], ['TRICEPS']), ex('dip', ['TRICEPS'], ['SHOULDERS']), ex('squat', ['QUADS'], [])],
    );
    expect(Object.fromEntries(load)).toEqual({ CHEST: 'PRIMARY', TRICEPS: 'PRIMARY', SHOULDERS: 'SECONDARY' });
  });
});
