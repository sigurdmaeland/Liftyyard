import type { WorkoutExercise, WorkoutTotals } from '@/types/workout';

/**
 * Samme definisjon som backend (WorkoutVolume): volum = Σ kg × reps for fullførte sett
 * som ikke er oppvarming. Sett uten vekt eller reps bidrar ikke.
 */
export function computeTotals(exercises: Pick<WorkoutExercise, 'sets'>[]): WorkoutTotals {
  let completedSetCount = 0;
  let volumeKg = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      if (!s.completedAt) continue;
      completedSetCount += 1;
      if (s.setType !== 'WARMUP' && s.weightKg !== null && s.reps !== null) {
        volumeKg += s.weightKg * s.reps;
      }
    }
  }
  return { exerciseCount: exercises.length, completedSetCount, volumeKg };
}
