import { deleteRequest, putJson } from '@/services/api';
import type { Measurement } from '@/types/measurement';

/** Idempotent: samme ID kan sendes flere ganger uten at det blir duplikater. */
export async function uploadMeasurement(m: Measurement): Promise<void> {
  await putJson(`/api/measurements/${m.id}`, { kind: m.kind, value: m.value, measuredAt: m.measuredAt });
}

export function deleteRemoteMeasurement(id: string): Promise<void> {
  return deleteRequest(`/api/measurements/${id}`);
}

export async function saveRemoteSettings(settings: {
  goalWeightKg: number | null;
  weeklyWorkoutGoal?: number | null;
  weightUnit?: 'KG' | 'LB';
}): Promise<void> {
  await putJson('/api/settings', settings);
}
