import { describe, expect, it } from '@jest/globals';

import { computeTotals } from '@/lib/metrics';
import type { WorkoutSet } from '@/types/workout';

const s = (p: Partial<WorkoutSet>): WorkoutSet => ({
  id: 'x',
  position: 0,
  setType: 'NORMAL',
  weightKg: null,
  reps: null,
  durationSeconds: null,
  distanceM: null,
  completedAt: '2026-10-20T10:00:00Z',
  ...p,
});

describe('computeTotals', () => {
  it('følger samme volumregel som backend', () => {
    const totals = computeTotals([
      {
        sets: [
          s({ setType: 'WARMUP', weightKg: 40, reps: 10 }), // telles som sett, ikke volum
          s({ weightKg: 80, reps: 8 }),
          s({ weightKg: 80, reps: 6, completedAt: null }), // ikke fullført
        ],
      },
      { sets: [s({ setType: 'FAILURE', weightKg: 100, reps: 5 })] },
    ]);
    expect(totals).toEqual({ exerciseCount: 2, completedSetCount: 3, volumeKg: 1140 });
  });
});
