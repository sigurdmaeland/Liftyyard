/**
 * Eksport av treningsdata som CSV (åpnes i Excel, Numbers og Google Regneark).
 * Én rad per sett. Vekt alltid i kg, så filen er entydig uansett hvilken enhet appen viser.
 */
export type ExportRow = {
  date: string;
  workout: string;
  exercise: string;
  setNumber: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  rpe: number | null;
  notes: string | null;
};

export const CSV_HEADER = ['Dato', 'Økt', 'Øvelse', 'Sett', 'Type', 'Vekt (kg)', 'Reps', 'Tid (s)', 'Distanse (m)', 'RPE', 'Notat'];

/** Felt med komma, anførselstegn eller linjeskift settes i anførselstegn (RFC 4180). */
function cell(v: string | number | null): string {
  if (v === null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_HEADER.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.date, r.workout, r.exercise, r.setNumber, r.setType, r.weightKg, r.reps, r.durationSeconds, r.distanceM, r.rpe, r.notes]
        .map(cell)
        .join(','),
    );
  }
  // BOM først så Excel leser æ, ø og å riktig.
  return `﻿${lines.join('\r\n')}\r\n`;
}
