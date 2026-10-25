import { describe, expect, it } from '@jest/globals';

import { formatWeight, fromDisplay, toDisplay } from '@/lib/units';

describe('vektenheter', () => {
  it('regner mellom kg og lb', () => {
    expect(toDisplay(100, 'LB')).toBe(220.5);
    expect(fromDisplay(225, 'LB')).toBeCloseTo(102.058, 3);
    expect(toDisplay(80, 'KG')).toBe(80);
  });
  it('runde pund overlever tur-retur', () => {
    expect(toDisplay(fromDisplay(135, 'LB'), 'LB')).toBe(135);
  });
  it('formaterer med enhet', () => {
    expect(formatWeight(82.5, 1, 'KG')).toBe('82,5 kg');
    expect(formatWeight(100, 0, 'LB')).toBe('221 lb');
  });
});
