import { describe, expect, it } from '@jest/globals';

import { CATEGORY_BY_KEY, exerciseFigure, inCategory, primaryCategory } from '@/lib/categories';

const ex = (primaryMuscles: string[], exerciseType = 'WEIGHT_REPS' as const) => ({ primaryMuscles, exerciseType, secondaryMuscles: [] });

describe('kategorier', () => {
  it('plasserer øvelser etter primærmuskler', () => {
    expect(inCategory(ex(['LATS']), CATEGORY_BY_KEY.BACK)).toBe(true);
    expect(inCategory(ex(['CHEST']), CATEGORY_BY_KEY.BACK)).toBe(false);
    expect(primaryCategory(ex(['HAMSTRINGS', 'GLUTES']))?.label).toBe('Hamstrings');
  });
  it('cardio er distanse og tid', () => {
    expect(inCategory({ primaryMuscles: ['QUADS'], exerciseType: 'DISTANCE_DURATION' }, CATEGORY_BY_KEY.CARDIO)).toBe(true);
  });
  it('velger figurside etter musklene', () => {
    expect(exerciseFigure({ primaryMuscles: ['LATS', 'UPPER_BACK'], secondaryMuscles: ['BICEPS'] }).side).toBe('back');
    expect(exerciseFigure({ primaryMuscles: ['CHEST'], secondaryMuscles: [] }).side).toBe('front');
  });
});
