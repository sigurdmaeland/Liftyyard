import { describe, expect, it } from '@jest/globals';

import { toProgramRequest, toRoutineRequest } from '@/services/programs';
import type { Routine } from '@/types/program';

describe('toRoutineRequest', () => {
  it('bygger kontrakten backend forventer, også for frittstående rutiner', () => {
    const r: Routine = {
      id: 'r1',
      programId: null,
      programName: null,
      position: 0,
      name: 'Push',
      notes: null,
      favorite: true,
      visibility: 'FOLLOWERS',
      sourceRoutineId: null,
      basedOn: null,
      copiedFromRoutineId: 'r0',
      updatedAt: '2026-10-21T10:00:00.000Z',
      syncStatus: 'pending',
      exercises: [
        {
          id: 'e1',
          position: 0,
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          exerciseType: 'WEIGHT_REPS',
          notes: null,
          restSeconds: 120,
          sets: [{ id: 's1', position: 0, setType: 'WARMUP', targetReps: 10, targetWeightKg: 40, targetDurationSeconds: null }],
        },
      ],
    };
    expect(toRoutineRequest(r)).toEqual({
      programId: null,
      position: 0,
      name: 'Push',
      notes: null,
      visibility: 'FOLLOWERS',
      copiedFromRoutineId: 'r0',
      exercises: [
        {
          id: 'e1',
          exerciseId: 'bench',
          notes: null,
          restSeconds: 120,
          sets: [{ id: 's1', setType: 'WARMUP', targetReps: 10, targetWeightKg: 40, targetDurationSeconds: null }],
        },
      ],
    });
  });
});

describe('toProgramRequest', () => {
  it('sender synlighet, nivå og dager per uke', () => {
    expect(
      toProgramRequest({ name: 'PPL', description: null, visibility: 'PUBLIC', level: 'BEGINNER', days_per_week: 3 }),
    ).toEqual({ name: 'PPL', description: null, visibility: 'PUBLIC', level: 'BEGINNER', daysPerWeek: 3 });
  });
});
