import type { ExerciseType, SetType, WorkoutVisibility } from '@/types/workout';

export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/** RoutineResponse fra backend. */
export type RemoteRoutine = {
  id: string;
  programId: string | null;
  position: number;
  name: string;
  notes: string | null;
  favorite: boolean;
  visibility: WorkoutVisibility;
  downloadCount: number;
  sourceRoutineId: string | null;
  basedOn?: Credit | null;
  createdAt: string;
  updatedAt: string;
  exercises: {
    id: string;
    exerciseId: string | null;
    exerciseName: string;
    exerciseType: ExerciseType;
    notes: string | null;
    restSeconds: number | null;
    sets: { id: string; setType: SetType; targetReps: number | null; targetWeightKg: number | null; targetDurationSeconds: number | null }[];
  }[];
};

/**
 * «Basert på»: originalen en kopi kom fra (alltid første opphav) og hvem som laget den.
 * authorUsername er null når kontoen er slettet eller for appens egne programmer.
 */
export type Credit = {
  id: string;
  name: string;
  authorId: string | null;
  authorUsername: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

/** Hvem som har laget et delt program eller en rutine. username er null for appens egne programmer. */
export type Author = { id: string; username: string | null; displayName: string; avatarUrl: string | null };

/** ExploreProgramResponse fra backend. mine = brukerens eget; fromFollowing = laget av noen brukeren følger. */
export type ExploreProgram = {
  id: string;
  name: string;
  description: string | null;
  authorName: string;
  author: Author;
  visibility: WorkoutVisibility;
  mine: boolean;
  fromFollowing: boolean;
  level: Level | null;
  daysPerWeek: number | null;
  routineCount: number;
  downloadCount: number;
  basedOn: Credit | null;
  /** Hvor mange delte programmer som bygger på dette. */
  remixCount: number;
  /** Forsidebildet, eller null (da vises en generert forside). */
  coverUrl?: string | null;
  createdAt: string;
  routines: RemoteRoutine[];
};

/** ExploreRoutineResponse fra backend: en delt, frittstående rutine. routine er bare med i detaljvisningen. */
export type ExploreRoutine = {
  id: string;
  name: string;
  notes: string | null;
  author: Author;
  visibility: WorkoutVisibility;
  mine: boolean;
  fromFollowing: boolean;
  exerciseCount: number;
  setCount: number;
  downloadCount: number;
  basedOn: Credit | null;
  createdAt: string;
  preview: { exerciseId: string | null; name: string; setCount: number }[];
  routine: RemoteRoutine | null;
};

/** ProgramResponse fra backend (eget program, f.eks. en nedlastet kopi). */
export type RemoteProgram = {
  id: string;
  name: string;
  description: string | null;
  visibility: WorkoutVisibility;
  level: Level | null;
  daysPerWeek: number | null;
  sourceProgramId: string | null;
  basedOn?: Credit | null;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  routines: RemoteRoutine[];
};
