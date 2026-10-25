import { deleteRequest, putJson } from '@/services/api';
import type { Level } from '@/types/explore';
import type { Routine, ShareVisibility } from '@/types/program';

type ProgramFields = {
  name: string;
  description: string | null;
  visibility: ShareVisibility;
  level: Level | null;
  days_per_week: number | null;
};

/** PUT /api/programs/{id}: bare programmets egne felt (se backend ProgramRequest). */
export function toProgramRequest(p: ProgramFields) {
  return { name: p.name, description: p.description, visibility: p.visibility, level: p.level, daysPerWeek: p.days_per_week };
}

/** PUT /api/routines/{id}: hele rutinen med øvelser og målsett (se backend RoutineRequest). */
export function toRoutineRequest(r: Routine) {
  return {
    programId: r.programId,
    position: r.position,
    name: r.name,
    notes: r.notes,
    visibility: r.visibility,
    copiedFromRoutineId: r.copiedFromRoutineId,
    exercises: r.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      restSeconds: e.restSeconds,
      sets: e.sets.map((s) => ({
        id: s.id,
        setType: s.setType,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
      })),
    })),
  };
}

export async function uploadProgram(p: ProgramFields & { id: string }): Promise<void> {
  await putJson(`/api/programs/${p.id}`, toProgramRequest(p));
}

export async function deleteRemoteProgram(id: string): Promise<void> {
  await deleteRequest(`/api/programs/${id}`);
}

export async function uploadRoutine(r: Routine): Promise<void> {
  await putJson(`/api/routines/${r.id}`, toRoutineRequest(r));
}

export async function deleteRemoteRoutine(id: string): Promise<void> {
  await deleteRequest(`/api/routines/${id}`);
}

export async function setRemoteRoutineFavorite(id: string, favorite: boolean): Promise<void> {
  if (favorite) await putJson(`/api/routines/${id}/favorite`, {});
  else await deleteRequest(`/api/routines/${id}/favorite`);
}
