import { describe, expect, it } from '@jest/globals';

import { describeSet, nextSetType, requiredFieldsFor, setLabels, suggestionFor } from '@/lib/set-fields';
import type { PreviousSet, WorkoutSet } from '@/types/workout';

const set = (p: Partial<WorkoutSet>): WorkoutSet => ({
  id: 'x',
  position: 0,
  setType: 'NORMAL',
  weightKg: null,
  reps: null,
  durationSeconds: null,
  distanceM: null,
  completedAt: null,
  ...p,
});

describe('setLabels', () => {
  it('nummererer arbeidssett og hopper over oppvarming', () => {
    const labels = setLabels([
      { setType: 'WARMUP' },
      { setType: 'NORMAL' },
      { setType: 'NORMAL' },
      { setType: 'FAILURE' },
      { setType: 'DROP' },
    ]);
    expect(labels).toEqual(['O', '1', '2', 'F', 'D']);
  });
});

describe('nextSetType', () => {
  it('går i ring', () => {
    expect(nextSetType('NORMAL')).toBe('WARMUP');
    expect(nextSetType('DROP')).toBe('NORMAL');
  });
});

describe('suggestionFor', () => {
  const previous: PreviousSet[] = [
    { setType: 'NORMAL', weightKg: 80, reps: 8, durationSeconds: null, distanceM: null },
  ];
  it('bruker samme sett forrige gang først', () => {
    expect(suggestionFor(0, [set({})], previous)).toEqual({ weightKg: 80, reps: 8 });
  });
  it('faller tilbake til forrige sett i økten', () => {
    const current = [set({ weightKg: 85, reps: 6 }), set({})];
    expect(suggestionFor(1, current, previous)).toEqual({ weightKg: 85, reps: 6 });
  });
  it('gir ingenting uten historikk', () => {
    expect(suggestionFor(0, [set({})], [])).toEqual({});
  });
});

describe('requiredFieldsFor', () => {
  it('krever vekt bare for vanlige vektøvelser', () => {
    expect(requiredFieldsFor('WEIGHT_REPS')).toEqual(['weightKg', 'reps']);
    expect(requiredFieldsFor('WEIGHTED_BODYWEIGHT')).toEqual(['reps']);
    expect(requiredFieldsFor('DURATION')).toEqual(['durationSeconds']);
  });
});

describe('describeSet', () => {
  const fmt = (n: number) => String(n).replace('.', ',');
  it('beskriver sett per øvelsestype', () => {
    const s = { setType: 'NORMAL' as const, weightKg: 82.5, reps: 5, durationSeconds: 60, distanceM: 500 };
    expect(describeSet('WEIGHT_REPS', s, fmt)).toBe('82,5 × 5');
    expect(describeSet('WEIGHTED_BODYWEIGHT', s, fmt)).toBe('+82,5 × 5');
    expect(describeSet('BODYWEIGHT_REPS', s, fmt)).toBe('5 reps');
    expect(describeSet('DURATION', s, fmt)).toBe('60 s');
    expect(describeSet('DISTANCE_DURATION', s, fmt)).toBe('500 m · 60 s');
  });
});
