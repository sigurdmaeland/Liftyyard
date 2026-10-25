import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { UserListScreen } from '@/features/social/user-list-screen';
import { fetchFollowing } from '@/services/social';

/** Hvem en bruker følger. */
export default function FollowingScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const load = useCallback(() => fetchFollowing(username), [username]);
  return <UserListScreen title="Følger" load={load} empty="Følger ingen ennå." />;
}
