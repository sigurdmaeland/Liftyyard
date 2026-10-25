import type { ExerciseType, SetType, WorkoutVisibility } from '@/types/workout';
import type { Credit, Level } from '@/types/explore';

/** Hvem som kan se og laste ned et program eller en rutine. Samme valg som for økter. */
export type ShareVisibility = WorkoutVisibility;

/** Et målsett i en rutine, f.eks. 8 reps på 80 kg. */
export type RoutineSet = {
  id: string;
  position: number;
  setType: SetType;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
};

export type RoutineExercise = {
  id: string;
  position: number;
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  notes: string | null;
  restSeconds: number | null;
  sets: RoutineSet[];
};

/** En rutine er en treningsdag i et program, f.eks. «Push». */
export type Routine = {
  id: string;
  /** null for frittstående rutiner. */
  programId: string | null;
  programName: string | null;
  position: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  /** Gjelder frittstående rutiner; rutiner i et program deles sammen med programmet. */
  visibility: ShareVisibility;
  /** Satt når rutinen er lastet ned fra en annen bruker. */
  sourceRoutineId: string | null;
  /** Kreditt til den som laget originalen (for nedlastede kopier og duplikater av dem). */
  basedOn: Credit | null;
  /** Lokal duplikat av denne rutinen; sendes med første gang så serveren kan følge kreditten. */
  copiedFromRoutineId: string | null;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  exercises: RoutineExercise[];
};

export type Program = {
  id: string;
  name: string;
  description: string | null;
  visibility: ShareVisibility;
  level: Level | null;
  daysPerWeek: number | null;
  /** Satt når programmet er lastet ned fra Utforsk. */
  sourceProgramId: string | null;
  basedOn: Credit | null;
  updatedAt: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  routines: Routine[];
};

export type ProgramSummary = {
  id: string;
  name: string;
  description: string | null;
  routineCount: number;
  visibility: ShareVisibility;
  updatedAt: string;
};
