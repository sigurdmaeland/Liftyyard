import type { ExerciseType, PreviousSet, SetType, WorkoutSet } from '@/types/workout';
import { toDisplay, unitLabel } from '@/lib/units';

export type SetField = 'weightKg' | 'reps' | 'durationSeconds' | 'distanceM';

export type FieldSpec = { key: SetField; label: string; decimal: boolean };

/** Hvilke felt et sett har, avhengig av øvelsestype. */
export function fieldsFor(type: ExerciseType): FieldSpec[] {
  switch (type) {
    case 'WEIGHT_REPS':
      return [
        { key: 'weightKg', label: unitLabel(), decimal: true },
        { key: 'reps', label: 'reps', decimal: false },
      ];
    case 'WEIGHTED_BODYWEIGHT':
      return [
        { key: 'weightKg', label: `+${unitLabel()}`, decimal: true },
        { key: 'reps', label: 'reps', decimal: false },
      ];
    case 'ASSISTED_BODYWEIGHT':
      return [
        { key: 'weightKg', label: `−${unitLabel()}`, decimal: true },
        { key: 'reps', label: 'reps', decimal: false },
      ];
    case 'BODYWEIGHT_REPS':
      return [{ key: 'reps', label: 'reps', decimal: false }];
    case 'DURATION':
      return [{ key: 'durationSeconds', label: 'sek', decimal: false }];
    case 'DISTANCE_DURATION':
      return [
        { key: 'distanceM', label: 'm', decimal: true },
        { key: 'durationSeconds', label: 'sek', decimal: false },
      ];
  }
}

/** Påkrevde felt for å kunne markere settet som fullført. Vekt kan være 0/tom for kroppsvekt-varianter. */
export function requiredFieldsFor(type: ExerciseType): SetField[] {
  return fieldsFor(type)
    .map((f) => f.key)
    .filter((k) => !(k === 'weightKg' && type !== 'WEIGHT_REPS'));
}

export const SET_TYPE_ORDER: SetType[] = ['NORMAL', 'WARMUP', 'FAILURE', 'DROP'];

export function nextSetType(current: SetType): SetType {
  return SET_TYPE_ORDER[(SET_TYPE_ORDER.indexOf(current) + 1) % SET_TYPE_ORDER.length];
}

/**
 * Etiketter i settkolonnen: arbeidssett nummereres (1, 2, 3), oppvarming vises som «O»,
 * failure som «F» og dropsett som «D». Oppvarming teller ikke med i nummereringen.
 */
export function setLabels(sets: Pick<WorkoutSet, 'setType'>[]): string[] {
  let n = 0;
  return sets.map((s) => {
    if (s.setType === 'WARMUP') return 'O';
    n += 1;
    if (s.setType === 'FAILURE') return 'F';
    if (s.setType === 'DROP') return 'D';
    return String(n);
  });
}

/**
 * Forslag til verdier for et sett: samme sett forrige gang, ellers forrige sett i denne økten.
 * Brukes som plassholder, og fylles inn når brukeren markerer settet uten å skrive noe.
 */
export function suggestionFor(
  index: number,
  current: Pick<WorkoutSet, SetField>[],
  previous: PreviousSet[],
): Partial<Record<SetField, number>> {
  const source = previous[index] ?? current[index - 1];
  if (!source) return {};
  const out: Partial<Record<SetField, number>> = {};
  for (const key of ['weightKg', 'reps', 'durationSeconds', 'distanceM'] as const) {
    const v = source[key];
    if (v !== null && v !== undefined) out[key] = v;
  }
  return out;
}

/** "80 × 8", "12 reps", "60 s", "500 m · 120 s". */
export function describeSet(type: ExerciseType, s: PreviousSet, format: (n: number) => string): string {
  // Vekten vises i valgt enhet (kg eller lb).
  const w = s.weightKg === null ? null : toDisplay(s.weightKg);
  switch (type) {
    case 'WEIGHT_REPS':
      return w !== null && s.reps !== null ? `${format(w)} × ${s.reps}` : '';
    case 'WEIGHTED_BODYWEIGHT':
      return s.reps !== null ? `${w ? `+${format(w)} × ` : ''}${s.reps}` : '';
    case 'ASSISTED_BODYWEIGHT':
      return s.reps !== null ? `${w ? `−${format(w)} × ` : ''}${s.reps}` : '';
    case 'BODYWEIGHT_REPS':
      return s.reps !== null ? `${s.reps} reps` : '';
    case 'DURATION':
      return s.durationSeconds !== null ? `${s.durationSeconds} s` : '';
    case 'DISTANCE_DURATION':
      return [s.distanceM !== null ? `${format(s.distanceM)} m` : '', s.durationSeconds !== null ? `${s.durationSeconds} s` : '']
        .filter(Boolean)
        .join(' · ');
  }
}
