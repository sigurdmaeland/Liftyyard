import { describe, expect, it } from '@jest/globals';

import { defaultWorkoutName, formatDuration, parseDecimal, parseInteger } from '@/lib/format';

describe('parseDecimal', () => {
  it('godtar komma og punktum', () => {
    expect(parseDecimal('82,5')).toBe(82.5);
    expect(parseDecimal('82.5')).toBe(82.5);
    expect(parseDecimal(' 100 ')).toBe(100);
  });
  it('gir null for tomt, ugyldig og negativt', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-5')).toBeNull();
  });
  it('runder heltall', () => {
    expect(parseInteger('7,6')).toBe(8);
  });
});

describe('formatDuration', () => {
  it('formaterer minutter og timer', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(3909)).toBe('1:05:09');
  });
});

describe('defaultWorkoutName', () => {
  it('velger navn etter tid på døgnet', () => {
    expect(defaultWorkoutName(new Date(2026, 9, 20, 7))).toBe('Morgenøkt');
    expect(defaultWorkoutName(new Date(2026, 9, 20, 14))).toBe('Ettermiddagsøkt');
    expect(defaultWorkoutName(new Date(2026, 9, 20, 19))).toBe('Kveldsøkt');
  });
});
