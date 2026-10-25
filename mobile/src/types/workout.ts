/** Domenetyper i appen. Speiler API-kontrakten (se backend WorkoutRequest/WorkoutResponse). */

export type ExerciseType =
  | 'WEIGHT_REPS'
  | 'BODYWEIGHT_REPS'
  | 'WEIGHTED_BODYWEIGHT'
  | 'ASSISTED_BODYWEIGHT'
  | 'DURATION'
  | 'DISTANCE_DURATION';

export type SetType = 'NORMAL' | 'WARMUP' | 'FAILURE' | 'DROP';

/** Navn på setttypene, til skjermlesere og forklaringer (bokstavene O/F/D sier lite alene). */
export const SET_TYPE_NAMES: Record<SetType, string> = {
  NORMAL: 'vanlig sett',
  WARMUP: 'oppvarming',
  FAILURE: 'til utmattelse',
  DROP: 'dropsett',
};

/**
 * local   = aktiv økt, kun på telefonen
 * pending = fullført, venter på opplasting
 * synced  = lagret på server
 * failed  = server avviste data (krever retting), prøves ikke automatisk igjen
 */
export type SyncStatus = 'local' | 'pending' | 'synced' | 'failed';

/** Hvem som ser økten: alle som kan se profilen, godtatte følgere (standard) eller bare meg. */
export type WorkoutVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

export const VISIBILITY_LABELS: Record<WorkoutVisibility, string> = {
  PUBLIC: 'Offentlig',
  FOLLOWERS: 'Følgere',
  PRIVATE: 'Bare meg',
};

export const VISIBILITY_DESCRIPTIONS: Record<WorkoutVisibility, string> = {
  PUBLIC: 'Alle som kan se profilen din',
  FOLLOWERS: 'Bare de som følger deg',
  PRIVATE: 'Bare deg',
};

export type Exercise = {
  id: string;
  name: string;
  exerciseType: ExerciseType;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions?: string | null;
  /** Brukerens egen øvelse. */
  custom?: boolean;
  favorite?: boolean;
};

export type WorkoutSet = {
  id: string;
  position: number;
  setType: SetType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceM: number | null;
  completedAt: string | null;
};

export type WorkoutExercise = {
  id: string;
  position: number;
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  notes: string | null;
  sets: WorkoutSet[];
  /** Samme tall på flere øvelser = supersett (gjøres etter hverandre). null = vanlig øvelse. */
  supersetGroup: number | null;
};

export type Workout = {
  id: string;
  name: string;
  /** Beskrivelse av økten («Hvordan gikk det?»). Kan deles når community kommer. */
  description: string | null;
  /** Private notater, vises bare for brukeren. */
  notes: string | null;
  /** Opplevd anstrengelse 1–10. */
  perceivedEffort: number | null;
  /** Rutinen økten ble startet fra, hvis noen. */
  sourceRoutineId: string | null;
  visibility: WorkoutVisibility;
  startedAt: string;
  endedAt: string | null;
  status: 'active' | 'finished';
  syncStatus: SyncStatus;
  syncError: string | null;
  exercises: WorkoutExercise[];
};

export type WorkoutTotals = {
  exerciseCount: number;
  completedSetCount: number;
  volumeKg: number;
};

export type WorkoutSummary = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  syncStatus: SyncStatus;
  totals: WorkoutTotals;
};

/** Forrige gang øvelsen ble gjennomført: fullførte sett i rekkefølge. */
export type PreviousSet = Pick<WorkoutSet, 'setType' | 'weightKg' | 'reps' | 'durationSeconds' | 'distanceM'>;
