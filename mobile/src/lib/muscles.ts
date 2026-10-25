import type { MuscleLoad } from '@/components/body-map';
import type { Exercise } from '@/types/workout';

/**
 * Hvilke muskler en økt har trent, ut fra øvelsesbiblioteket. En muskel som er primær i én
 * øvelse er primær for økten. Øvelser uten fullførte sett teller ikke.
 */
export function muscleLoad(exercises: { exerciseId: string | null; sets: { completedAt: string | null }[] }[], catalog: Exercise[]): MuscleLoad {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const load: MuscleLoad = new Map();
  for (const we of exercises) {
    if (!we.sets.some((s) => s.completedAt)) continue;
    const ex = we.exerciseId ? byId.get(we.exerciseId) : undefined;
    if (!ex) continue;
    for (const m of ex.primaryMuscles) load.set(m, 'PRIMARY');
    for (const m of ex.secondaryMuscles) if (!load.has(m)) load.set(m, 'SECONDARY');
  }
  return load;
}
