import { describe, expect, it } from '@jest/globals';

import { toWorkoutRequest } from '@/services/workouts';
import type { Workout } from '@/types/workout';

describe('toWorkoutRequest', () => {
  it('bygger kontrakten backend forventer', () => {
    const w: Workout = {
      id: 'w1',
      name: 'Push',
      description: 'Tung dag',
      notes: null,
      perceivedEffort: 8,
      sourceRoutineId: 'r1',
      visibility: 'PUBLIC',
      startedAt: '2026-10-20T10:00:00.000Z',
      endedAt: '2026-10-20T11:00:00.000Z',
      status: 'finished',
      syncStatus: 'pending',
      syncError: null,
      exercises: [
        {
          id: 'e1',
          position: 0,
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
          exerciseType: 'WEIGHT_REPS',
          notes: 'Smal grep',
          supersetGroup: 2,
          sets: [
            {
              id: 's1',
              position: 0,
              setType: 'NORMAL',
              weightKg: 80,
              reps: 8,
              durationSeconds: null,
              distanceM: null,
              completedAt: '2026-10-20T10:05:00.000Z',
            },
          ],
        },
      ],
    };
    expect(toWorkoutRequest(w)).toEqual({
      name: 'Push',
      description: 'Tung dag',
      notes: null,
      perceivedEffort: 8,
      sourceRoutineId: 'r1',
      startedAt: '2026-10-20T10:00:00.000Z',
      endedAt: '2026-10-20T11:00:00.000Z',
      visibility: 'PUBLIC',
      exercises: [
        {
          id: 'e1',
          exerciseId: 'ex-bench',
          notes: 'Smal grep',
          supersetGroup: 2,
          sets: [
            {
              id: 's1',
              setType: 'NORMAL',
              weightKg: 80,
              reps: 8,
              durationSeconds: null,
              distanceM: null,
              completedAt: '2026-10-20T10:05:00.000Z',
            },
          ],
        },
      ],
    });
  });
});
