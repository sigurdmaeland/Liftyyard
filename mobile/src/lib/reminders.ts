/**
 * Treningspåminnelser: én per ukedag, med eget klokkeslett. Rene funksjoner (lagring og varsler
 * ligger i features/settings/reminders.ts), så de kan testes.
 */
export type Reminder = { weekday: number; enabled: boolean; hour: number; minute: number };

/** Mandag = 1 … søndag = 7 (norsk rekkefølge). */
export const WEEKDAY_NAMES = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
const SHORT = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];

export const DEFAULT_REMINDERS: Reminder[] = WEEKDAY_NAMES.map((_, i) => ({ weekday: i + 1, enabled: false, hour: 17, minute: 0 }));

/** Leser lagrede påminnelser; ugyldige eller manglende dager får standardverdien. */
export function parseReminders(json: string | null): Reminder[] {
  let saved: unknown = null;
  try {
    saved = json ? JSON.parse(json) : null;
  } catch {
    saved = null;
  }
  const list = Array.isArray(saved) ? (saved as Partial<Reminder>[]) : [];
  return DEFAULT_REMINDERS.map((d) => {
    const s = list.find((r) => r?.weekday === d.weekday);
    const ok = (n: unknown, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
    return s && ok(s.hour, 23) && ok(s.minute, 59) ? { weekday: d.weekday, enabled: s.enabled === true, hour: s.hour!, minute: s.minute! } : d;
  });
}

/** Expo/iOS teller søndag = 1 … lørdag = 7. */
export function toExpoWeekday(weekday: number): number {
  return (weekday % 7) + 1;
}

export const formatTime = (r: Pick<Reminder, 'hour' | 'minute'>) => `${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}`;

/** Kort oppsummering for Innstillinger: «Av», «Hver dag kl. 17:00» eller «Man, ons, fre». */
export function summarize(reminders: Reminder[]): string {
  const on = reminders.filter((r) => r.enabled);
  if (on.length === 0) return 'Av';
  const sameTime = on.every((r) => r.hour === on[0].hour && r.minute === on[0].minute);
  const days = on.length === 7 ? 'Hver dag' : on.map((r) => SHORT[r.weekday - 1]).join(', ').replace(/^./, (c) => c.toUpperCase());
  return sameTime ? `${days} kl. ${formatTime(on[0])}` : days;
}
