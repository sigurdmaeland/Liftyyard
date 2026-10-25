import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { BodyFigure } from '@/components/body-map';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { SyncBadge } from '@/features/history/sync-badge';
import { openReport } from '@/features/safety/actions';
import { UserAvatar } from '@/features/social/user-avatar';
import { PhotoPager } from '@/features/workout-view/hero';
import { RecordSummary } from '@/features/workout-view/medals';
import { ActionBar, SocialSummary, shareWorkout } from '@/features/workout-view/social-bar';
import { VISIBILITY_ICONS } from '@/features/workout/visibility-picker';
import { useCatalog } from '@/hooks/use-catalog';
import { useTheme } from '@/hooks/use-theme';
import { exerciseFigure } from '@/lib/categories';
import { formatVolume } from '@/lib/format';
import { type RecordSummaryValue, formatRelativeDateTime, formatShortDuration } from '@/lib/stats';
import type { FeedItem } from '@/services/feed';
import { Radius, Spacing } from '@/theme';
import { type SyncStatus, VISIBILITY_LABELS } from '@/types/workout';

const MAX_TILES = 4;

/**
 * Ett innlegg i feeden: forfatter, tittel, nøkkeltall, bilder i full bredde (eller øvelsene
 * som fliser), liker/kommentarer og knapper for å like, kommentere og dele.
 * Trykk på kortet åpner økten; trykk på forfatteren åpner profilen.
 */
export function FeedCard({
  item,
  onChange,
  onOpen,
  syncStatus,
  records,
}: {
  item: FeedItem;
  onChange?: (item: FeedItem) => void;
  /** Overstyrer hva som skjer ved trykk på kortet (f.eks. egen økt → lokal visning). */
  onOpen?: () => void;
  /** Egen økt fra telefonen: liker og kommentarer skjules, og synkstatus vises hvis den ikke er synket. */
  syncStatus?: SyncStatus;
  /** Rekorder i økten (bare for egne økter, regnes ut på telefonen). */
  records?: RecordSummaryValue;
}) {
  const theme = useTheme();
  // Rekorder: regnet ut på telefonen for egne økter, ellers fra serveren.
  const recordInfo =
    records ?? (item.recordCount ? { count: item.recordCount, medals: item.recordMedals ?? [] } : undefined);
  const partners = item.partners ?? [];
  // Økter fra telefonen (uten nett, eller ikke synket ennå) har ingen liker/kommentarer å vise.
  const local = syncStatus !== undefined;
  const pending = local && syncStatus !== 'synced';
  const seconds = (new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 1000;
  const open =
    onOpen ??
    (() =>
      local
        ? router.push({ pathname: '/history/[id]', params: { id: item.id } })
        : router.push({ pathname: '/post/[id]', params: { id: item.id } }));

  const menu = () =>
    Alert.alert(item.name, undefined, [
      { text: 'Åpne økten', onPress: open },
      ...(item.author.isSelf ? [{ text: 'Del som bilde', onPress: () => router.push({ pathname: '/share/workout', params: { id: item.id } }) }] : []),
      { text: item.author.isSelf ? 'Del som tekst' : 'Del', onPress: () => shareWorkout(item, item.author.isSelf ? undefined : item.author.displayName) },
      ...(!item.author.isSelf ? [{ text: 'Rapporter økten', onPress: () => openReport('WORKOUT', item.id, item.author.username) }] : []),
      { text: 'Avbryt', style: 'cancel' as const },
    ]);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityHint="Åpner økten"
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.push({ pathname: '/user/[username]', params: { username: item.author.username } })}
            accessibilityRole="button"
            accessibilityLabel={`Profilen til ${item.author.displayName}`}
            style={styles.authorRow}>
            <UserAvatar uri={item.author.avatarUrl} size={48} />
            <View style={styles.headerText}>
              <ThemedText style={styles.author} numberOfLines={1}>
                {item.author.displayName}
              </ThemedText>
              <View style={styles.dateRow}>
                <Icon name={VISIBILITY_ICONS[item.visibility]} size={13} color={theme.textSecondary} fallback="" />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  accessibilityLabel={`${formatRelativeDateTime(item.startedAt)}, ${VISIBILITY_LABELS[item.visibility]}`}>
                  {formatRelativeDateTime(item.startedAt)}
                </ThemedText>
              </View>
            </View>
          </Pressable>
          {pending && syncStatus && <SyncBadge status={syncStatus} />}
          {!local && (
            <Pressable onPress={menu} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Valg for økten ${item.name}`} style={styles.more}>
              <Icon name="ellipsis" size={20} color={theme.textSecondary} fallback="⋯" />
            </Pressable>
          )}
        </View>

        {partners.length > 0 && <PartnersLine partners={partners} />}

        <View style={styles.titleBlock}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {item.name}
          </ThemedText>
          {item.description && <ThemedText themeColor="textSecondary">{item.description}</ThemedText>}
        </View>

        <View style={styles.stats}>
          <Stat label="Varighet" value={formatShortDuration(seconds)} />
          <Stat label="Volum" value={formatVolume(item.volumeKg)} />
          <View style={styles.flex} />
          {recordInfo && recordInfo.count > 0 && (
            <View style={styles.stat}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.right}>
                Rekorder
              </ThemedText>
              <RecordSummary medals={recordInfo.medals} count={recordInfo.count} />
            </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

      {item.photoUrls.length > 0 ? (
        <View style={styles.bleed}>
          <PhotoPager uris={item.photoUrls} />
        </View>
      ) : (
        <ExerciseTiles item={item} onPress={open} />
      )}

      {!local && (
        <View style={styles.social}>
          <SocialSummary item={item} />
          <ActionBar
            item={item}
            author={item.author.isSelf ? undefined : item.author.displayName}
            onChange={(likedByMe, likeCount) => onChange?.({ ...item, likedByMe, likeCount })}
          />
        </View>
      )}
    </View>
  );
}

/** «Trente med Kari og 2 til». Trykk åpner profilen til den første. */
export function PartnersLine({ partners }: { partners: FeedItem['author'][] }) {
  const theme = useTheme();
  const [first, ...rest] = partners;
  const label = `Trente med ${first.displayName}${rest.length > 0 ? ` og ${rest.length} til` : ''}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/user/[username]', params: { username: first.username } })}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Åpner profilen til ${first.displayName}.`}
      style={styles.partners}>
      <View style={styles.partnerAvatars}>
        {partners.slice(0, 3).map((p, i) => (
          <View key={p.id} style={[styles.partnerAvatar, { marginLeft: i === 0 ? 0 : -8, borderColor: theme.background }]}>
            <UserAvatar uri={p.avatarUrl} size={24} />
          </View>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Øvelsene som fliser med muskelfigur og «3 × Markløft» under, når økten ikke har bilder. */
function ExerciseTiles({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const theme = useTheme();
  const catalog = useCatalog();
  const shown = item.exercises.slice(0, MAX_TILES);
  const hidden = item.exercises.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Øvelser: ${item.exercises.map((e) => `${e.setCount} sett ${e.exerciseName}`).join(', ')}`}
      style={styles.tiles}>
      {shown.map((e, i) => {
        const exercise = e.exerciseId ? catalog.get(e.exerciseId) : undefined;
        const figure = exercise ? exerciseFigure(exercise) : null;
        return (
          <View key={`${e.exerciseId}-${i}`} style={styles.tile}>
            <View style={[styles.tileImage, { backgroundColor: theme.tile }]}>
              {figure ? (
                <BodyFigure side={figure.side} load={figure.load} height={64} crop="upper" />
              ) : (
                <Icon name="dumbbell.fill" size={22} color={theme.textSecondary} fallback="•" />
              )}
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.tileText}>
              {e.setCount} × {e.exerciseName}
            </ThemedText>
          </View>
        );
      })}
      {hidden > 0 && (
        <View style={styles.tile}>
          <View style={[styles.tileImage, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.plus}>+{hidden}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.tileText}>
            {hidden === 1 ? 'øvelse' : 'øvelser'} til
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingTop: Spacing.four, paddingBottom: Spacing.two, gap: Spacing.three },
  body: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center' },
  more: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  plus: { fontSize: 18, fontWeight: 700 },
  authorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  headerText: { flex: 1, gap: 2 },
  author: { fontSize: 17, fontWeight: 700 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleBlock: { gap: Spacing.one },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
  stats: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.five },
  stat: { gap: 2 },
  right: { textAlign: 'right' },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: 700, fontVariant: ['tabular-nums'] },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
  bleed: { marginHorizontal: -Spacing.four },
  tiles: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two },
  tile: { width: 76, alignItems: 'center', gap: Spacing.one },
  tileImage: { width: 72, height: 72, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tileText: { textAlign: 'center' },
  social: { gap: Spacing.one, paddingTop: Spacing.two },
  partners: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  partnerAvatars: { flexDirection: 'row' },
  partnerAvatar: { borderWidth: 2, borderRadius: 14 },
});
