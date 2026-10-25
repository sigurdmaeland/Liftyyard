import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { pickJpeg } from '@/lib/image';
import { MAX_WORKOUT_PHOTOS } from '@/storage/photo-store';
import { Radius, Spacing } from '@/theme';

/** Bilder på en økt: miniatyrer og «Legg til bilde» (maks 4). Trykk på et bilde for å fjerne det. */
export function PhotoStrip({
  photos,
  onAdd,
  onRemove,
  onRetry,
  size = 84,
}: {
  photos: { id: string; uri: string; uploading?: boolean; error?: string | null }[];
  onAdd?: (uri: string) => void;
  onRemove?: (id: string) => void;
  /** Nytt forsøk på et bilde serveren avviste. */
  onRetry?: (id: string) => void;
  size?: number;
}) {
  const theme = useTheme();
  const pick = async () => {
    try {
      const uri = await pickJpeg({ maxSide: 2048 });
      if (uri) onAdd?.(uri);
    } catch {
      Alert.alert('Kunne ikke bruke bildet', 'Prøv et annet bilde.');
    }
  };
  const confirmRemove = (p: { id: string; error?: string | null }) =>
    Alert.alert(p.error ? 'Bildet ble ikke lastet opp' : 'Fjerne bildet?', p.error ?? undefined, [
      { text: 'Avbryt', style: 'cancel' },
      ...(p.error && onRetry ? [{ text: 'Prøv igjen', onPress: () => onRetry(p.id) }] : []),
      { text: 'Fjern', style: 'destructive' as const, onPress: () => onRemove?.(p.id) },
    ]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {photos.map((p) => (
        <Pressable
          key={p.id}
          onPress={onRemove ? () => confirmRemove(p) : undefined}
          disabled={!onRemove}
          accessibilityRole={onRemove ? 'button' : 'image'}
          accessibilityLabel={`Bilde fra økten${p.error ? ', opplastingen feilet' : p.uploading ? ', lastes opp' : ''}`}
          accessibilityHint={onRemove ? 'Trykk for å fjerne bildet' : undefined}>
          <Image source={{ uri: p.uri }} style={{ width: size, height: size, borderRadius: Radius.medium }} contentFit="cover" />
          {(p.error || p.uploading) && (
            <View style={[styles.badge, { backgroundColor: p.error ? theme.dangerFill : 'rgba(0,0,0,0.55)' }]}>
              <Icon name={p.error ? 'exclamationmark' : 'icloud.and.arrow.up'} size={12} color="#FFFFFF" fallback={p.error ? '!' : '↑'} />
            </View>
          )}
        </Pressable>
      ))}
      {onAdd && photos.length < MAX_WORKOUT_PHOTOS && (
        <Pressable
          onPress={pick}
          accessibilityRole="button"
          style={[styles.add, { width: size, height: size, borderColor: theme.backgroundSelected }]}>
          <Icon name="camera" color={theme.textSecondary} fallback="📷" />
          <ThemedText type="small" themeColor="textSecondary">
            Legg til
          </ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two },
  badge: { position: 'absolute', right: 4, bottom: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  add: { borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
