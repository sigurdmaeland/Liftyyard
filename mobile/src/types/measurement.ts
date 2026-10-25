import { fromDisplay, toDisplay, unitLabel } from '@/lib/units';

/**
 * Kroppsmålinger. Speiler backend MeasurementKind: WEIGHT i kg, BODY_FAT i prosent, resten i cm.
 * Kroppsvekt lagres alltid i kg, men vises og skrives inn i valgt vektenhet (kg/lb).
 */
export type MeasurementKind =
  | 'WEIGHT'
  | 'BODY_FAT'
  | 'HEIGHT'
  | 'NECK'
  | 'SHOULDERS'
  | 'CHEST'
  | 'WAIST'
  | 'HIPS'
  | 'LEFT_ARM'
  | 'RIGHT_ARM'
  | 'LEFT_FOREARM'
  | 'RIGHT_FOREARM'
  | 'LEFT_THIGH'
  | 'RIGHT_THIGH'
  | 'LEFT_CALF'
  | 'RIGHT_CALF';

export type Measurement = {
  id: string;
  kind: MeasurementKind;
  value: number;
  measuredAt: string;
};

export const MEASUREMENT_LABELS: Record<MeasurementKind, string> = {
  WEIGHT: 'Vekt',
  BODY_FAT: 'Kroppsfett',
  HEIGHT: 'Høyde',
  NECK: 'Nakke',
  SHOULDERS: 'Skuldre',
  CHEST: 'Bryst',
  WAIST: 'Midje',
  HIPS: 'Hofter',
  LEFT_ARM: 'Venstre overarm',
  RIGHT_ARM: 'Høyre overarm',
  LEFT_FOREARM: 'Venstre underarm',
  RIGHT_FOREARM: 'Høyre underarm',
  LEFT_THIGH: 'Venstre lår',
  RIGHT_THIGH: 'Høyre lår',
  LEFT_CALF: 'Venstre legg',
  RIGHT_CALF: 'Høyre legg',
};

/** Omkretsmål i rekkefølgen de vises under «Kroppsmål». */
export const BODY_PART_KINDS: MeasurementKind[] = [
  'WAIST',
  'CHEST',
  'HIPS',
  'SHOULDERS',
  'NECK',
  'LEFT_ARM',
  'RIGHT_ARM',
  'LEFT_FOREARM',
  'RIGHT_FOREARM',
  'LEFT_THIGH',
  'RIGHT_THIGH',
  'LEFT_CALF',
  'RIGHT_CALF',
];

export function measurementUnit(kind: MeasurementKind): string {
  if (kind === 'WEIGHT') return unitLabel();
  if (kind === 'BODY_FAT') return '%';
  return 'cm';
}

/** Rimelige grenser for inntasting (samme øvre grense som serveren). */
export function measurementLimits(kind: MeasurementKind): { min: number; max: number } {
  // Grensene gjelder verdien slik den skrives inn, altså i valgt enhet for vekt.
  if (kind === 'WEIGHT') return { min: Math.ceil(toDisplay(20)), max: Math.floor(toDisplay(400)) };
  if (kind === 'BODY_FAT') return { min: 1, max: 75 };
  if (kind === 'HEIGHT') return { min: 50, max: 260 };
  return { min: 5, max: 300 };
}

export function isMeasurementKind(value: string | undefined): value is MeasurementKind {
  return value !== undefined && value in MEASUREMENT_LABELS;
}

/** Lagret verdi → det brukeren ser (kroppsvekt i valgt enhet). */
export function toMeasurementDisplay(kind: MeasurementKind, value: number): number {
  return kind === 'WEIGHT' ? toDisplay(value) : value;
}

/** Innskrevet verdi → det som lagres (kroppsvekt i kg), avrundet til to desimaler. */
export function fromMeasurementDisplay(kind: MeasurementKind, value: number): number {
  return Math.round((kind === 'WEIGHT' ? fromDisplay(value) : value) * 100) / 100;
}
