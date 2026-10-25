import { deleteRequest, getJson, postJson, putJson } from '@/services/api';
import type { RemoteWorkoutDetail, UserSummary } from '@/services/social';
import type { WorkoutVisibility } from '@/types/workout';

/** En økt i feeden eller på en profil (speiler backend FeedItem). */
export type FeedItem = {
  id: string;
  name: string;
  description: string | null;
  startedAt: string;
  endedAt: string;
  visibility: WorkoutVisibility;
  author: UserSummary;
  exercises: { exerciseId: string | null; exerciseName: string; setCount: number }[];
  completedSetCount: number;
  volumeKg: number;
  photoUrls: string[];
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
  /** Rekorder i økten (regnet ut på serveren) og hvilke medaljer (1 gull, 2 sølv, 3 bronse). */
  recordCount?: number;
  recordMedals?: (1 | 2 | 3)[];
  /** Hvem eieren trente sammen med. */
  partners?: UserSummary[];
};

/** Feed: dine økter og øktene til dem du følger. `before` = startedAt for siste økt på forrige side. */
export function fetchFeed(before?: string): Promise<FeedItem[]> {
  return getJson<FeedItem[]>(`/api/feed?limit=20${before ? `&before=${encodeURIComponent(before)}` : ''}`);
}

export function fetchUserFeed(username: string, before?: string): Promise<FeedItem[]> {
  return getJson<FeedItem[]>(`/api/users/${encodeURIComponent(username)}/workouts?limit=20${before ? `&before=${encodeURIComponent(before)}` : ''}`);
}

export type ServerSetRecord = { kind: 'E1RM' | 'WEIGHT' | 'VOLUME'; medal: 1 | 2 | 3 };

/** records: sett-ID → rekorder (medaljer). */
export type WorkoutView = {
  summary: FeedItem;
  workout: RemoteWorkoutDetail & { notes: string | null };
  records?: Record<string, ServerSetRecord[]>;
};

export function fetchWorkoutView(id: string): Promise<WorkoutView> {
  return getJson<WorkoutView>(`/api/workouts/${id}/view`);
}

export function likeWorkout(id: string): Promise<void> {
  return putJson(`/api/workouts/${id}/like`, {});
}

export function unlikeWorkout(id: string): Promise<void> {
  return deleteRequest(`/api/workouts/${id}/like`);
}

export function fetchLikes(id: string): Promise<UserSummary[]> {
  return getJson<UserSummary[]>(`/api/workouts/${id}/likes`);
}

/** parentId er satt for svar (ett nivå). */
export type Comment = {
  id: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  canDelete: boolean;
  parentId?: string | null;
  likeCount?: number;
  likedByMe?: boolean;
};

export function fetchComments(workoutId: string): Promise<Comment[]> {
  return getJson<Comment[]>(`/api/workouts/${workoutId}/comments`);
}

/** Legger til en kommentar (idempotent på ID) og returnerer alle kommentarene. */
export function addComment(workoutId: string, id: string, body: string, parentId?: string | null): Promise<Comment[]> {
  return postJson<Comment[]>(`/api/workouts/${workoutId}/comments`, { id, body, parentId: parentId ?? null });
}

export async function setCommentLike(id: string, like: boolean): Promise<void> {
  if (like) await putJson(`/api/comments/${id}/like`, {});
  else await deleteRequest(`/api/comments/${id}/like`);
}

/** Hvem du trente med (erstatter listen). Bare folk du følger eller som følger deg. */
export async function setWorkoutPartners(workoutId: string, usernames: string[]): Promise<void> {
  await putJson(`/api/workouts/${workoutId}/partners`, { usernames });
}

export function leaveWorkoutPartner(workoutId: string): Promise<void> {
  return deleteRequest(`/api/workouts/${workoutId}/partners/me`);
}

export function deleteComment(id: string): Promise<void> {
  return deleteRequest(`/api/comments/${id}`);
}

export type NotificationType =
  | 'FOLLOW'
  | 'FOLLOW_REQUEST'
  | 'FOLLOW_ACCEPTED'
  | 'LIKE'
  | 'COMMENT'
  | 'DOWNLOAD'
  | 'COMMENT_LIKE'
  | 'REPLY'
  | 'TAG'
  | 'MENTION';

export type AppNotification = {
  id: string;
  type: NotificationType;
  actor: UserSummary;
  workoutId: string | null;
  workoutName: string | null;
  commentPreview: string | null;
  createdAt: string;
  read: boolean;
  /** DOWNLOAD: hva som ble lastet ned (navnet er null hvis det er slettet). */
  programId: string | null;
  routineId: string | null;
  targetName: string | null;
};

export function fetchNotifications(): Promise<AppNotification[]> {
  return getJson<AppNotification[]>('/api/notifications');
}

export async function fetchUnreadCount(): Promise<number> {
  return (await getJson<{ count: number }>('/api/notifications/unread-count')).count;
}

export function markNotificationsRead(): Promise<void> {
  return postJson('/api/notifications/read');
}
