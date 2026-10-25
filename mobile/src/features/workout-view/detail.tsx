import { Stack, router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { UserAvatar } from '@/features/social/user-avatar';
import { CircleButton } from '@/features/workout-view/circle-button';
import { PhotoPager } from '@/features/workout-view/hero';
import { VISIBILITY_ICONS } from '@/features/workout/visibility-picker';
import { useTheme } from '@/hooks/use-theme';
import { formatRelativeDateTime } from '@/lib/stats';
import { MaxContentWidth, Spacing } from '@/theme';
import { VISIBILITY_LABELS, type WorkoutVisibility } from '@/types/workout';

/**
 * Ramme for visning av en fullført økt. Med bilder ligger bildene i full bredde øverst, og
 * innholdet i et ark som overlapper bildet (runde knapper for tilbake og valg over bildet).
 * Uten bilder brukes vanlig tittellinje.
 */
export function WorkoutDetailScaffold({ photos, onMenu, children }: { photos: string[]; onMenu?: () => void; children: ReactNode }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const hero = photos.length > 0;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={
          hero
            ? {
                title: 'Økt',
                headerTransparent: true,
                headerTitle: '',
                headerShadowVisible: false,
                headerBackVisible: false,
                headerLeft: () => <CircleButton icon="chevron.left" label="Tilbake" onPress={() => router.back()} />,
                headerRight: onMenu ? () => <CircleButton icon="ellipsis" label="Valg for økten" onPress={onMenu} /> : undefined,
              }
            : {
                title: 'Økt',
                headerTransparent: false,
                headerRight: onMenu
                  ? () => (
                      <Pressable onPress={onMenu} hitSlop={12} accessibilityRole="button" accessibilityLabel="Valg for økten">
                        <Icon name="ellipsis" color={theme.text} fallback="⋯" />
                      </Pressable>
                    )
                  : undefined,
              }
        }
      />
      <ScrollView contentInsetAdjustmentBehavior={hero ? 'never' : 'automatic'} keyboardShouldPersistTaps="handled">
        {hero && <PhotoPager uris={photos} height={Math.round(height * 0.5)} dots={false} />}
        <View style={[styles.sheet, hero && styles.overlap, { backgroundColor: theme.background }]}>
          {hero && <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/** Forfatter og tidspunkt øverst i en økt. Trykk åpner profilen når username er satt. */
export function AuthorHeader({
  avatarUrl,
  name,
  username,
  startedAt,
  visibility,
  right,
}: {
  avatarUrl: string | null;
  name: string;
  username?: string | null;
  startedAt: string;
  visibility: WorkoutVisibility;
  right?: ReactNode;
}) {
  const theme = useTheme();
  const content = (
    <>
      <UserAvatar uri={avatarUrl} size={52} />
      <View style={styles.authorText}>
        <ThemedText style={styles.authorName} numberOfLines={1}>
          {name}
        </ThemedText>
        <View style={styles.dateRow}>
          <Icon name={VISIBILITY_ICONS[visibility]} size={13} color={theme.textSecondary} fallback="" />
          <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={`${formatRelativeDateTime(startedAt)}, ${VISIBILITY_LABELS[visibility]}`}>
            {formatRelativeDateTime(startedAt)}
          </ThemedText>
        </View>
      </View>
    </>
  );
  return (
    <View style={styles.authorRow}>
      {username ? (
        <Pressable
          onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
          accessibilityRole="button"
          accessibilityLabel={`Profilen til ${name}`}
          style={styles.author}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.author}>{content}</View>
      )}
      {right}
    </View>
  );
}

/** Tykk skillelinje mellom seksjoner (kant til kant). */
export function SectionDivider() {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />;
}

/** «🔒 Privat notat» – bare synlig for eieren. */
export function PrivateNote({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.note}>
      <View style={styles.noteHead}>
        <Icon name="lock.fill" size={16} color={theme.text} fallback="🔒" />
        <ThemedText style={styles.noteTitle}>Privat notat</ThemedText>
      </View>
      <ThemedText>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  overlap: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: Spacing.two },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  authorText: { flex: 1, gap: 2 },
  authorName: { fontSize: 17, fontWeight: 700 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: 8, marginHorizontal: -Spacing.four, marginVertical: Spacing.two },
  note: { gap: Spacing.two },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  noteTitle: { fontSize: 17, fontWeight: 700 },
});
