import { deleteRequest, getJson, postJson } from '@/services/api';

export type FollowStatus = 'NONE' | 'PENDING' | 'FOLLOWING';

/** En bruker i søk og lister (bare offentlige felt). */
export type UserSummary = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  isSelf: boolean;
  followStatus: FollowStatus;
};

/** Forslag til folk å følge (venners venner først). */
export type Suggestion = { user: UserSummary; mutualCount: number };

export function fetchSuggestions(): Promise<Suggestion[]> {
  return getJson<Suggestion[]>('/api/users/suggestions');
}

export function searchUsers(query: string): Promise<UserSummary[]> {
  return getJson<UserSummary[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

/** Følger, eller sender forespørsel hvis profilen er privat. Returnerer ny status. */
export async function followUser(username: string): Promise<FollowStatus> {
  const res = await postJson<{ followStatus: FollowStatus }>(`/api/users/${encodeURIComponent(username)}/follow`);
  return res.followStatus;
}

export function unfollowUser(username: string): Promise<void> {
  return deleteRequest(`/api/users/${encodeURIComponent(username)}/follow`);
}

export function fetchFollowers(username: string): Promise<UserSummary[]> {
  return getJson<UserSummary[]>(`/api/users/${encodeURIComponent(username)}/followers`);
}

export function fetchFollowing(username: string): Promise<UserSummary[]> {
  return getJson<UserSummary[]>(`/api/users/${encodeURIComponent(username)}/following`);
}

export function fetchFollowRequests(): Promise<UserSummary[]> {
  return getJson<UserSummary[]>('/api/me/follow-requests');
}

export function acceptFollowRequest(username: string): Promise<void> {
  return postJson(`/api/me/follow-requests/${encodeURIComponent(username)}/accept`);
}

export function declineFollowRequest(username: string): Promise<void> {
  return deleteRequest(`/api/me/follow-requests/${encodeURIComponent(username)}`);
}

export function removeFollower(username: string): Promise<void> {
  return deleteRequest(`/api/me/followers/${encodeURIComponent(username)}`);
}

/** En økt med øvelser og sett slik den kommer fra serveren (GET /api/workouts/{id}/view). */
export type RemoteWorkoutDetail = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  totals: { exerciseCount: number; completedSetCount: number; volumeKg: number };
  description: string | null;
  perceivedEffort: number | null;
  exercises: {
    id: string;
    exerciseId: string;
    exerciseName: string;
    exerciseType: string;
    notes: string | null;
    supersetGroup?: number | null;
    sets: {
      id: string;
      setType: 'NORMAL' | 'WARMUP' | 'FAILURE' | 'DROP';
      weightKg: number | null;
      reps: number | null;
      durationSeconds: number | null;
      distanceM: number | null;
      completedAt: string | null;
    }[];
  }[];
};
