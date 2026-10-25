import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { UserListScreen } from '@/features/social/user-list-screen';
import { fetchLikes } from '@/services/feed';

/** Hvem som har likt en økt. */
export default function LikesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => fetchLikes(id), [id]);
  return <UserListScreen title="Liker" load={load} empty="Ingen har likt økten ennå." />;
}
