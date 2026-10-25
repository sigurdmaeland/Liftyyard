import { computeTotals } from '@/lib/metrics';
import type { FeedItem } from '@/services/feed';
import type { Profile } from '@/types/profile';
import type { Workout } from '@/types/workout';

/**
 * Gjør en økt fra telefonen om til samme form som feeden fra serveren, slik at egne økter
 * (også de som ikke er synket ennå) vises med samme kort.
 */
export function localFeedItem(w: Workout, profile: Profile, photoUris: string[] = []): FeedItem {
  const totals = computeTotals(w.exercises);
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    startedAt: w.startedAt,
    endedAt: w.endedAt ?? w.startedAt,
    visibility: w.visibility,
    author: {
      id: 'me',
      username: profile.username ?? '',
      displayName: profile.displayName ?? 'Du',
      avatarUrl: profile.photoUri,
      isPrivate: profile.visibility === 'PRIVATE',
      isSelf: true,
      followStatus: 'NONE',
    },
    exercises: w.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseName,
      setCount: e.sets.filter((s) => s.completedAt).length,
    })),
    completedSetCount: totals.completedSetCount,
    volumeKg: totals.volumeKg,
    photoUrls: photoUris,
    likeCount: 0,
    likedByMe: false,
    commentCount: 0,
  };
}
