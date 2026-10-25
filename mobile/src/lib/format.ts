import { toDisplay, unitLabel } from '@/lib/units';

/** Tolker tall skrevet med komma eller punktum ("82,5" og "82.5"). Tomt/ugyldig gir null. */
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (normalized === '') return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseInteger(input: string): number | null {
  const value = parseDecimal(input);
  return value === null ? null : Math.round(value);
}

export function formatNumber(value: number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('nb-NO', { maximumFractionDigits: maxDecimals, useGrouping: false });
}

/** Volum vises uten desimaler og med tusenskille: "12 340 kg" (eller lb, se innstillinger). */
export function formatVolume(kg: number): string {
  return `${Math.round(toDisplay(kg)).toLocaleString('nb-NO')} ${unitLabel()}`;
}

/** "1:05:09" eller "12:34". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function secondsBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

/** Standardnavn ut fra tid på døgnet, som brukeren kan endre. */
export function defaultWorkoutName(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 11) return 'Morgenøkt';
  if (h < 17) return 'Ettermiddagsøkt';
  return 'Kveldsøkt';
}
