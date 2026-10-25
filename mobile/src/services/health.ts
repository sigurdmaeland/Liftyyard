import { getJson } from '@/services/api';

/** Speiler HealthResponse fra backend (GET /api/health). */
export type HealthResponse = {
  status: 'UP' | 'DOWN';
  database: 'UP' | 'DOWN';
  version: string;
  timestamp: string;
};

export function fetchHealth(): Promise<HealthResponse> {
  return getJson<HealthResponse>('/api/health');
}
