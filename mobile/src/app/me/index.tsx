import { Stack, router, useFocusEffect } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import type { SFSymbol } from 'sf-symbols-typescript';
import { WeeklyChartCard } from '@/features/profile/weekly-chart-card';
import { useLocalQuery } from '@/hooks/use-local-query';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { formatVolume } from '@/lib/format';
import { computeTotals } from '@/lib/metrics';
import { totalsSince } from '@/lib/profile-stats';
import { weekStreak } from '@/lib/stats';
import { fetchPublicProfile } from '@/services/profile';
import { fetchFollowRequests } from '@/services/social';
import { listFinishedWorkoutsDetailed } from '@/storage/workout-store';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

const load = (db: SQLiteDatabase) => listFinishedWorkoutsDetailed(db, 5000);
const WEEKS_SHOWN = 12;

/**
 * Profilen din: bilde, navn, treninger, følgere og følger, ukesgraf, historikk og statistikk.
 * Følgertallene hentes fra serveren (vises som «–» uten nett).
 */
export default function MeScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const [social, setSocial] = useState<{ followers: number | null; following: number | null; requests: number }>({
    followers: null,
    following: null,
    requests: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (!profile.username) return;
      let active = true;
      Promise.all([fetchPublicProfile(profile.username), fetchFollowRequests()])
        .then(([p, requests]) => active && setSocial({ followers: p.followerCount, following: p.followingCount, requests: requests.length }))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [profile.username]),
  );
  const openList = (list: 'followers' | 'following') =>
    profile.username &&
    router.push({ pathname: list === 'followers' ? '/user/[username]/followers' : '/user/[username]/following', params: { username: profile.username } });
  const { state } = useLocalQuery(load);
  const workouts = useMemo(() => (state.status === 'ready' ? state.data : []), [state]);
  const stats = useMemo(
    () => ({
      count: workouts.length,
      streak: weekStreak(workouts),
      volume: workouts.reduce((sum, w) => sum + computeTotals(w.exercises).volumeKg, 0),
      yearVolume: totalsSince(workouts, new Date(new Date().getFullYear(), 0, 1)).volumeKg,
    }),
    [workouts],
  );
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * (WEEKS_SHOWN - 1));
    return d;
  }, []);
  const name = profile.displayName ?? '';

  const share = () => {
    const who = name ? `${name}${profile.username ? ` (@${profile.username})` : ''}` : 'Jeg';
    const message = `${who} har fullført ${stats.count} ${stats.count === 1 ? 'økt' : 'økter'} og løftet ${formatVolume(stats.volume)} totalt${
      stats.streak > 0 ? `, med ${stats.streak} ${stats.streak === 1 ? 'uke' : 'uker'} på rad` : ''
    }.`;
    Share.share({ message }).catch(() => {});
  };

  const circle = [styles.headerButton, { backgroundColor: theme.backgroundElement }];

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: 'Profil',
          headerTransparent: true,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={circle} accessibilityRole="button" accessibilityLabel="Tilbake">
              <Icon name="chevron.left" size={20} color={theme.text} fallback="‹" />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable onPress={share} style={circle} accessibilityRole="button" accessibilityLabel="Del profil">
                <Icon name="arrowshape.turn.up.right" size={20} color={theme.text} fallback="⇪" />
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} style={circle} accessibilityRole="button" accessibilityLabel="Innstillinger">
                <Icon name="gearshape" size={20} color={theme.text} fallback="⚙" />
              </Pressable>
            </View>
          ),
        }}
      />

      <View style={styles.top}>
        <Avatar size={112} />
        <ThemedText style={styles.name} accessibilityRole="header">
          {name || 'Du'}
        </ThemedText>
        {profile.username && (
          <ThemedText themeColor="textSecondary" style={styles.handle}>
            @{profile.username}
          </ThemedText>
        )}
        {profile.bio && (
          <ThemedText themeColor="textSecondary" style={styles.bio}>
            {profile.bio}
          </ThemedText>
        )}
        {!name && (
          <Pressable onPress={() => router.push('/me/edit')} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Legg til navn
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.stats}>
          <Stat value={String(stats.count)} label="Treninger" />
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          <Stat value={social.followers === null ? '–' : String(social.followers)} label="Følgere" onPress={() => openList('followers')} />
          <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
          <Stat value={social.following === null ? '–' : String(social.following)} label="Følger" onPress={() => openList('following')} />
        </View>

        <View style={styles.buttons}>
          <Pressable onPress={() => router.push('/me/edit')} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.buttonLabel}>Rediger profil</ThemedText>
          </Pressable>
          <Pressable onPress={share} accessibilityRole="button" style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.buttonLabel}>Del profil</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />

      <WeeklyChartCard workouts={workouts} from={from} />

      <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />

      <View>
        {social.requests > 0 && (
          <LinkRow
            icon="person.badge.plus"
            title="Følgeforespørsler"
            subtitle={`${social.requests} venter på svar`}
            onPress={() => router.push('/me/requests')}
          />
        )}
        <LinkRow
          icon="list.bullet.clipboard"
          title="Treningshistorie"
          subtitle={`${stats.count} ${stats.count === 1 ? 'treningsøkt' : 'treningsøkter'}`}
          onPress={() => router.push('/me/history')}
        />
        <LinkRow icon="doc.text" title="Statistikk" subtitle={`År-til-dato: ${formatVolume(stats.yearVolume)}`} onPress={() => router.push('/me/stats')} />
        <LinkRow icon="calendar" title="Månedsoppsummering" subtitle="Se og del måneden din" onPress={() => router.push('/me/month')} />
      </View>
    </ScrollView>
  );
}

function LinkRow({ icon, title, subtitle, onPress }: { icon: SFSymbol; title: string; subtitle: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} size={24} color={theme.text} fallback="•" />
      <View style={styles.linkText}>
        <ThemedText style={styles.linkTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <Icon name="chevron.right" size={16} color={theme.textSecondary} fallback="›" />
    </Pressable>
  );
}

function Stat({ value, label, onPress }: { value: string; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'} style={styles.stat}>
      <ThemedText style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: 60, gap: Spacing.four, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: Spacing.two },
  top: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.three },
  name: { fontSize: 28, lineHeight: 34, fontWeight: 700, textAlign: 'center' },
  handle: { marginTop: -Spacing.three },
  bio: { textAlign: 'center', marginTop: -Spacing.two },
  stats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: Spacing.two },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.one },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
  divider: { width: 1, height: 32 },
  buttons: { flexDirection: 'row', gap: Spacing.three, alignSelf: 'stretch' },
  button: { flex: 1, minHeight: 46, borderRadius: Radius.large, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontWeight: 600 },
  separator: { height: 8, marginHorizontal: -Spacing.four },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  linkText: { flex: 1 },
  linkTitle: { fontSize: 18, fontWeight: 600 },
});
