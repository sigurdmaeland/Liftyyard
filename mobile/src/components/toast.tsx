import { useEffect, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/*
 * Kort melding øverst på skjermen (f.eks. «Ny rekord!»). Forsvinner av seg selv etter noen
 * sekunder, kan trykkes bort, og leses opp av skjermleser.
 */
type Toast = { id: number; title: string; text?: string; icon?: SFSymbol; iconColor?: string };

let current: Toast | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(t: Omit<Toast, 'id'>) {
  current = { ...t, id: nextId++ };
  AccessibilityInfo.announceForAccessibility(`${t.title}${t.text ? `. ${t.text}` : ''}`);
  emit();
}

function hide(id: number) {
  if (current?.id === id) {
    current = null;
    emit();
  }
}

export function ToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => hide(toast.id), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + Spacing.two }]}>
      <Animated.View key={toast.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Pressable
          onPress={() => hide(toast.id)}
          accessibilityRole="alert"
          accessibilityHint="Trykk for å lukke"
          style={[styles.toast, { backgroundColor: theme.card, borderColor: theme.backgroundSelected }]}>
          {toast.icon && <Icon name={toast.icon} size={26} color={toast.iconColor ?? theme.accent} fallback="•" />}
          <View style={styles.text}>
            <ThemedText style={styles.title}>{toast.title}</ThemedText>
            {toast.text && (
              <ThemedText type="small" themeColor="textSecondary">
                {toast.text}
              </ThemedText>
            )}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: Spacing.three, right: Spacing.three, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flex: 1, gap: 2 },
  title: { fontWeight: 700 },
});
