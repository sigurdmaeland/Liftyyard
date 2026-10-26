import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/theme';

/** Seksjon i innstillingene: stor overskrift og en tynn linje over (ikke for den første). */
export function SettingsSection({ title, subtitle, first, children }: { title?: string; subtitle?: string; first?: boolean; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
      {title && (
        <View style={styles.header}>
          <ThemedText accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle && (
            <ThemedText themeColor="textSecondary" numberOfLines={1}>
              {subtitle}
            </ThemedText>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

/**
 * Én rad: ikon, tittel og eventuelt undertittel (gjeldende verdi). `right` vises til høyre
 * (f.eks. en bryter). Uten ikon rykkes ikke teksten inn (brukes for «Logg ut» og «Slett konto»).
 */
export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  destructive,
  busy,
  chevron,
  accessibilityHint,
}: {
  icon?: SFSymbol;
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  right?: ReactNode;
  destructive?: boolean;
  busy?: boolean;
  chevron?: boolean;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  const content = (
    <>
      {icon && (
        <View style={styles.icon}>
          <Icon name={icon} size={24} color={color} fallback="•" />
        </View>
      )}
      <View style={styles.text}>
        <ThemedText style={[styles.rowTitle, { color }]}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {busy ? <ActivityIndicator /> : right}
      {chevron && !busy && <Icon name="chevron.right" size={14} color={theme.textSecondary} fallback="›" />}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible={!right} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!busy }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.55 : 1 }]}>
      {content}
    </Pressable>
  );
}

/** Rad i en valgliste (f.eks. Tema og Enheter): hake på valgt verdi. */
export function ChoiceRow({ label, description, selected, onPress }: { label: string; description?: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.row, styles.choice, { borderBottomColor: theme.backgroundSelected, opacity: pressed ? 0.55 : 1 }]}>
      <View style={styles.text}>
        <ThemedText style={styles.rowTitle}>{label}</ThemedText>
        {description && (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        )}
      </View>
      {selected && <Icon name="checkmark" size={18} color={theme.accent} fallback="✓" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: Spacing.two },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: 2 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: 800 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 60, paddingVertical: Spacing.two },
  icon: { width: 32, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 17, lineHeight: 22 },
  choice: { borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
});
