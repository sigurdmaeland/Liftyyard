import { describe, expect, it } from '@jest/globals';

import { type ExportRow, toCsv } from '@/lib/export';

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  date: '2026-10-26',
  workout: 'Push',
  exercise: 'Benkpress',
  setNumber: 1,
  setType: 'Vanlig',
  weightKg: 80,
  reps: 8,
  durationSeconds: null,
  distanceM: null,
  rpe: null,
  notes: null,
  ...over,
});

describe('toCsv', () => {
  it('har overskrift, BOM og én linje per sett', () => {
    const csv = toCsv([row(), row({ setNumber: 2, weightKg: 82.5 })]);
    expect(csv.startsWith('﻿Dato,Økt,Øvelse,Sett')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('2026-10-26,Push,Benkpress,1,Vanlig,80,8,,,,');
    expect(lines[2]).toContain(',82.5,');
  });

  it('beskytter komma, anførselstegn og linjeskift', () => {
    const csv = toCsv([row({ workout: 'Bein, tungt', notes: 'Sa «hei» og "ha det"\nny linje' })]);
    expect(csv).toContain('"Bein, tungt"');
    expect(csv).toContain('"Sa «hei» og ""ha det""\nny linje"');
  });
});
