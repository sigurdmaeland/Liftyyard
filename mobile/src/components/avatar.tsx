import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

/** Brukerens profilbilde, eller en nøytral figur hvis det ikke er valgt noe bilde. */
export function Avatar({ size = 44 }: { size?: number }) {
  const theme = useTheme();
  const { photoUri } = useProfile();
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected }]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Icon name="person.fill" size={size * 0.55} color={theme.textSecondary} fallback="●" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
