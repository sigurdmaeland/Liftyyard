import { deleteRequest, getJson, putJson } from '@/services/api';
import type { Exercise } from '@/types/workout';

/** Speiler ExerciseResponse fra backend (GET /api/exercises). */
type ExerciseResponse = Exercise & { custom: boolean; favorite: boolean; instructions: string | null; updatedAt: string };

export async function fetchExerciseCatalog(): Promise<Exercise[]> {
  const items = await getJson<ExerciseResponse[]>('/api/exercises');
  return items.map(({ id, name, exerciseType, equipment, primaryMuscles, secondaryMuscles, instructions, custom, favorite }) => ({
    id,
    name,
    exerciseType,
    equipment,
    primaryMuscles,
    secondaryMuscles,
    instructions,
    custom,
    favorite,
  }));
}

export function toExerciseRequest(e: Exercise) {
  return {
    name: e.name,
    exerciseType: e.exerciseType,
    equipment: e.equipment,
    instructions: e.instructions ?? null,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
  };
}

export async function uploadCustomExercise(e: Exercise): Promise<void> {
  await putJson(`/api/exercises/${e.id}`, toExerciseRequest(e));
}

export async function archiveRemoteExercise(id: string): Promise<void> {
  await deleteRequest(`/api/exercises/${id}`);
}

export async function setRemoteExerciseFavorite(id: string, favorite: boolean): Promise<void> {
  if (favorite) await putJson(`/api/exercises/${id}/favorite`, {});
  else await deleteRequest(`/api/exercises/${id}/favorite`);
}
