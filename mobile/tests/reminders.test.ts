import { describe, expect, it } from '@jest/globals';

import { DEFAULT_REMINDERS, parseReminders, summarize, toExpoWeekday } from '@/lib/reminders';

describe('påminnelser', () => {
  it('mandag–søndag blir Expos søndag=1-teller', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(toExpoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });

  it('tåler tom, ødelagt og ufullstendig lagring', () => {
    expect(parseReminders(null)).toEqual(DEFAULT_REMINDERS);
    expect(parseReminders('{ikke json')).toEqual(DEFAULT_REMINDERS);
    const r = parseReminders(JSON.stringify([{ weekday: 3, enabled: true, hour: 6, minute: 30 }, { weekday: 5, enabled: true, hour: 99, minute: 0 }]));
    expect(r[2]).toEqual({ weekday: 3, enabled: true, hour: 6, minute: 30 });
    expect(r[4]).toEqual(DEFAULT_REMINDERS[4]);
    expect(r).toHaveLength(7);
  });

  it('oppsummerer valgte dager', () => {
    const on = (days: number[], hour = 17) => DEFAULT_REMINDERS.map((d) => ({ ...d, enabled: days.includes(d.weekday), hour }));
    expect(summarize(DEFAULT_REMINDERS)).toBe('Av');
    expect(summarize(on([1, 3, 5]))).toBe('Man, ons, fre kl. 17:00');
    expect(summarize(on([1, 2, 3, 4, 5, 6, 7], 7))).toBe('Hver dag kl. 07:00');
    const mixed = on([1, 2]);
    mixed[1] = { ...mixed[1], hour: 18 };
    expect(summarize(mixed)).toBe('Man, tir');
  });
});
