import { describe, expect, it } from '@jest/globals';

import { latestAllowedBirthDate, normalizeUsername, suggestUsername, usernameProblem } from '@/types/profile';

describe('brukernavn', () => {
  it('foreslår brukernavn fra navnet med æ, ø og å', () => {
    expect(suggestUsername('Sigurd', 'Mæland')).toBe('sigurd.maeland');
    expect(suggestUsername('Åse', 'Øvrebø-Hansen')).toBe('ase.ovrebohansen');
    expect(suggestUsername('José', '')).toBe('jose');
  });

  it('normaliserer og sjekker formatet', () => {
    expect(normalizeUsername('  @Sigurd.M ')).toBe('sigurd.m');
    expect(usernameProblem('ab')).toBe('Minst 3 tegn');
    expect(usernameProblem('ole-hansen')).not.toBeNull();
    expect(usernameProblem('.ole')).not.toBeNull();
    expect(usernameProblem('ole..h')).not.toBeNull();
    expect(usernameProblem('ole_h.92')).toBeNull();
  });
});

describe('aldersgrense', () => {
  it('siste tillatte fødselsdato er 13 år tilbake', () => {
    expect(latestAllowedBirthDate(new Date(2026, 9, 23))).toEqual(new Date(2013, 9, 23));
  });
});
