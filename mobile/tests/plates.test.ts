import { describe, expect, it } from '@jest/globals';

import { platesFor } from '@/lib/plates';

describe('platesFor', () => {
  it('fordeler tyngste skiver først', () => {
    expect(platesFor(100).perSide).toEqual([25, 15]);
    expect(platesFor(142.5)).toEqual({ perSide: [25, 25, 10, 1.25], achieved: 142.5, remainder: 0 });
  });

  it('håndterer lett stang og mål under stangvekten', () => {
    expect(platesFor(20, 20).perSide).toEqual([]);
    expect(platesFor(30, 15).perSide).toEqual([5, 2.5]);
  });

  it('sier fra når målet ikke kan nås med skivene', () => {
    const r = platesFor(61, 20);
    expect(r.achieved).toBe(60);
    expect(r.remainder).toBe(1);
  });
});
