import { describe, expect, it } from '@jest/globals';

import { estimateCalories } from '@/lib/calories';

describe('estimateCalories', () => {
  it('regner MET × vekt × timer', () => {
    expect(estimateCalories(80, 3600)).toBe(400);
    expect(estimateCalories(70, 1800)).toBe(175);
  });
  it('gir null uten vekt eller varighet', () => {
    expect(estimateCalories(null, 3600)).toBeNull();
    expect(estimateCalories(80, 0)).toBeNull();
  });
});
