import { describe, expect, it } from '@jest/globals';

import { monthSummary } from '@/lib/month';
import type { Workout } from '@/types/workout';

let n = 0;
const w = (startedAt: string, name: string, weight: number): Workout => ({
  id: `w${n++}`, name, description: null, notes: null, perceivedEffort: null, sourceRoutineId: null, visibility: 'FOLLOWERS',
  startedAt, endedAt: new Date(new Date(startedAt).getTime() + 3600000).toISOString(), status: 'finished', syncStatus: 'synced', syncError: null,
  exercises: [{ id: `e${n}`, position: 0, exerciseId: name, exerciseName: name, exerciseType: 'WEIGHT_REPS', notes: null, supersetGroup: null,
    sets: [{ id: `s${n}`, position: 0, setType: 'NORMAL', weightKg: weight, reps: 5, durationSeconds: null, distanceM: null, completedAt: startedAt }] }],
});

describe('monthSummary', () => {
  it('summerer bare økter i måneden og teller dager og øvelser', () => {
    const all = [
      w('2026-09-30T10:00:00Z', 'Knebøy', 100),
      w('2026-10-02T10:00:00Z', 'Knebøy', 105),
      w('2026-10-02T18:00:00Z', 'Benk', 80),
      w('2026-10-05T10:00:00Z', 'Knebøy', 110),
    ];
    const s = monthSummary(all, 2026, 9);
    expect(s.workouts).toBe(3);
    expect(s.activeDays).toBe(2);
    expect(s.seconds).toBe(3 * 3600);
    expect(s.volumeKg).toBe(105 * 5 + 80 * 5 + 110 * 5);
    expect(s.topExercises[0]).toEqual({ name: 'Knebøy', workouts: 2 });
    expect(s.records).toBe(6); // to nye knebøy-rekorder × (1RM, vekt, volum)
  });
});
