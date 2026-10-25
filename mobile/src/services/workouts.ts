import { deleteRequest, putJson, uploadFile } from '@/services/api';
import type { Workout } from '@/types/workout';

/** Bygger forespørselen til PUT /api/workouts/{id} (se backend WorkoutRequest). */
export function toWorkoutRequest(w: Workout) {
  return {
    name: w.name,
    description: w.description,
    notes: w.notes,
    perceivedEffort: w.perceivedEffort,
    sourceRoutineId: w.sourceRoutineId,
    startedAt: w.startedAt,
    endedAt: w.endedAt,
    visibility: w.visibility,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      supersetGroup: e.supersetGroup ?? null,
      sets: e.sets.map((s) => ({
        id: s.id,
        setType: s.setType,
        weightKg: s.weightKg,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        distanceM: s.distanceM,
        completedAt: s.completedAt,
      })),
    })),
  };
}

/** Idempotent: trygg å kalle flere ganger for samme økt. */
export async function uploadWorkout(w: Workout): Promise<void> {
  await putJson(`/api/workouts/${w.id}`, toWorkoutRequest(w));
}

/** Idempotent: sletting av en økt som ikke finnes på serveren er ikke en feil. */
export async function deleteRemoteWorkout(id: string): Promise<void> {
  await deleteRequest(`/api/workouts/${id}`);
}

/** Laster opp et bilde til en økt (idempotent på bildets ID). Returnerer adressen. */
export async function uploadPhoto(workoutId: string, photoId: string, fileUri: string): Promise<string> {
  const res = await uploadFile<{ url: string }>('POST', `/api/workouts/${workoutId}/photos/${photoId}`, fileUri, 'image/jpeg');
  return res.url;
}

export async function deleteRemotePhoto(workoutId: string, photoId: string): Promise<void> {
  await deleteRequest(`/api/workouts/${workoutId}/photos/${photoId}`);
}
