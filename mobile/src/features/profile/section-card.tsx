import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { Radius, Spacing } from '@/theme';

/** Hvitt kort på grå bakgrunn med tittel, undertittel og valgfri handling øverst til høyre. */
export function SectionCard({
  title,
  subtitle,
  action,
  onPress,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  /** Gjør hele kortet trykkbart (med pil til høyre). */
  onPress?: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const header = title !== undefined && (
    <View style={styles.header}>
      <View style={styles.titles}>
        <ThemedText accessibilityRole="header" style={styles.title}>{title}</ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button" style={[styles.action, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">{action.label}</ThemedText>
        </Pressable>
      )}
      {onPress && <Icon name="chevron.right" size={16} color={theme.textSecondary} fallback="›" />}
    </View>
  );
  const body = (
    <>
      {header}
      {children}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, { backgroundColor: theme.card, opacity: pressed ? 0.7 : 1 }]}>
        {body}
      </Pressable>
    );
  }
  return <View style={[styles.card, { backgroundColor: theme.card }]}>{body}</View>;
}

/** Valg mellom noen få alternativer (periode, måltall). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'segment',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  variant?: 'segment' | 'chips';
}) {
  const theme = useTheme();
  if (variant === 'chips') {
    return (
      <View style={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.chip, { backgroundColor: selected ? theme.text : theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={{ color: selected ? theme.background : theme.text }}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segmentItem, selected && { backgroundColor: theme.card }]}>
            <ThemedText type={selected ? 'smallBold' : 'small'}>{o.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titles: { flex: 1 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: 700 },
  action: { paddingHorizontal: Spacing.three, minHeight: 44, borderRadius: 16, justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  chips: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  chip: { paddingHorizontal: Spacing.three, minHeight: 40, borderRadius: 16, justifyContent: 'center' },
});
