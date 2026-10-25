import { describe, expect, it } from '@jest/globals';

import { estimateOneRepMax, setRecordsByWorkout } from '@/lib/records';

const set = (id: string, weightKg: number, reps: number, setType: 'NORMAL' | 'WARMUP' = 'NORMAL') => ({
  id, setType, weightKg, reps, completedAt: '2026-10-01T10:00:00Z',
});
const workout = (id: string, day: number, sets: ReturnType<typeof set>[], exerciseId = 'curl') => ({
  id, startedAt: `2026-10-${String(day).padStart(2, '0')}T10:00:00Z`, exercises: [{ exerciseId, sets }],
});

describe('estimateOneRepMax', () => {
  it('bruker Epley og avrunder ikke', () => {
    expect(estimateOneRepMax(20, 10)).toBeCloseTo(26.67, 1);
    expect(estimateOneRepMax(30, 8)).toBe(38);
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(null, 5)).toBeNull();
    expect(estimateOneRepMax(50, 0)).toBeNull();
  });
});

describe('setRecordsByWorkout', () => {
  it('gir ingen medaljer første gang en øvelse logges', () => {
    const r = setRecordsByWorkout([workout('a', 1, [set('a1', 20, 10), set('a2', 25, 8)])]);
    expect(r.get('a')!.size).toBe(0);
  });

  it('rangerer nye verdier blant de tre beste og hopper over oppvarming og likeverdier', () => {
    const r = setRecordsByWorkout([
      workout('old', 1, [set('o1', 20, 10), set('o2', 22, 8)]),
      workout('new', 5, [set('n0', 40, 10, 'WARMUP'), set('n1', 20, 10), set('n2', 30, 8), set('n3', 21, 10)]),
    ]);
    const n = r.get('new')!;
    expect(n.has('n0')).toBe(false); // oppvarming
    expect(n.has('n1')).toBe(false); // samme som før
    expect(n.get('n2')).toEqual([
      { kind: 'E1RM', medal: 1 },
      { kind: 'WEIGHT', medal: 1 },
      { kind: 'VOLUME', medal: 1 },
    ]);
    // 21 × 10: 1RM 28 er nest best (etter 38), vekt 21 er tredje best (30, 22), volum 210 er nest best (240).
    expect(n.get('n3')).toEqual([
      { kind: 'E1RM', medal: 2 },
      { kind: 'WEIGHT', medal: 3 },
      { kind: 'VOLUME', medal: 2 },
    ]);
  });
});
