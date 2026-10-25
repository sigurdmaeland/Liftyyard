import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useTheme } from '@/hooks/use-theme';

/** Profilbilde for en vilkårlig bruker (adresse fra serveren), med nøytral figur som reserve. */
export function UserAvatar({ uri, size = 44 }: { uri: string | null; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="person.fill" size={size * 0.55} color={theme.textSecondary} fallback="●" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
