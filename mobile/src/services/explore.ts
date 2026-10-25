import { getJson, postJson } from '@/services/api';
import type { ExploreProgram, ExploreRoutine, RemoteProgram, RemoteRoutine } from '@/types/explore';

const enc = encodeURIComponent;

/** Delte programmer brukeren kan se (offentlige og fra folk man følger), mest lastet ned først. */
export function fetchExplorePrograms(q?: string): Promise<ExploreProgram[]> {
  return getJson<ExploreProgram[]>(q ? `/api/explore/programs?q=${enc(q)}` : '/api/explore/programs');
}

export function fetchExploreProgram(id: string): Promise<ExploreProgram> {
  return getJson<ExploreProgram>(`/api/explore/programs/${id}`);
}

/** Kopierer programmet til brukerens bibliotek på serveren. copyId gjør kallet trygt å gjenta. */
export function downloadProgram(id: string, copyId: string): Promise<RemoteProgram> {
  return postJson<RemoteProgram>(`/api/explore/programs/${id}/download`, { copyId });
}

/** Delte frittstående rutiner brukeren kan se, mest lastet ned først. */
export function fetchExploreRoutines(q?: string): Promise<ExploreRoutine[]> {
  return getJson<ExploreRoutine[]>(q ? `/api/explore/routines?q=${enc(q)}` : '/api/explore/routines');
}

export function fetchExploreRoutine(id: string): Promise<ExploreRoutine> {
  return getJson<ExploreRoutine>(`/api/explore/routines/${id}`);
}

/** Kopierer rutinen til brukerens bibliotek (frittstående, privat). copyId gjør kallet trygt å gjenta. */
export function downloadRoutine(id: string, copyId: string): Promise<RemoteRoutine> {
  return postJson<RemoteRoutine>(`/api/explore/routines/${id}/download`, { copyId });
}

/** Programmer og rutiner en bruker har delt (det innlogget bruker har lov til å se). */
export function fetchUserPrograms(username: string): Promise<ExploreProgram[]> {
  return getJson<ExploreProgram[]>(`/api/users/${enc(username)}/programs`);
}

export function fetchUserRoutines(username: string): Promise<ExploreRoutine[]> {
  return getJson<ExploreRoutine[]>(`/api/users/${enc(username)}/routines`);
}
