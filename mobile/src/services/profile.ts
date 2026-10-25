import { deleteRequest, getJson, putJson, uploadFile } from '@/services/api';
import type { FollowStatus } from '@/services/social';
import type { ServerProfile } from '@/storage/profile-store';
import type { ProfileFields } from '@/types/profile';

/** Erstatter profilen på serveren. Fornavn er påkrevd. */
export async function saveRemoteProfile(profile: ProfileFields): Promise<void> {
  await putJson('/api/me', profile);
}

export function fetchMyProfile(): Promise<ServerProfile> {
  return getJson<ServerProfile>('/api/me');
}

export type UsernameAvailability = { username: string; available: boolean; reason: string | null };

export function checkUsername(username: string): Promise<UsernameAvailability> {
  return getJson<UsernameAvailability>(`/api/usernames/${encodeURIComponent(username)}`);
}

/** Setter brukernavnet. Kaster ApiError 409 hvis det er tatt. */
export function saveUsername(username: string): Promise<ServerProfile> {
  return putJson<ServerProfile>('/api/me/username', { username });
}

export async function uploadAvatar(fileUri: string): Promise<string> {
  const res = await uploadFile<{ avatarUrl: string }>('POST', '/api/me/avatar', fileUri, 'image/jpeg');
  return res.avatarUrl;
}

export function deleteRemoteAvatar(): Promise<void> {
  return deleteRequest('/api/me/avatar');
}

/** En annen brukers profil slik den er synlig for deg. */
export type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  isSelf: boolean;
  /** null når profilen er privat og du ikke følger den. */
  workoutCount: number | null;
  followerCount: number | null;
  followingCount: number | null;
  followStatus: FollowStatus;
  followsYou: boolean;
  /** Øktene vises for eieren og godtatte følgere. */
  canViewWorkouts: boolean;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  /** Du har blokkert brukeren: bare navn og bilde vises, så du kan oppheve blokkeringen. */
  blockedByYou: boolean;
};

export function fetchPublicProfile(username: string): Promise<PublicProfile> {
  return getJson<PublicProfile>(`/api/users/${encodeURIComponent(username)}`);
}
