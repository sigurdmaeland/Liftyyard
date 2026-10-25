import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LEGAL_DOCUMENTS, type LegalDocId } from '@/features/legal/documents';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/theme';

/** Vilkår, personvernerklæring eller retningslinjer, med overskrifter som skjermlesere kan hoppe mellom. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDocId }>();
  const theme = useTheme();
  const d = LEGAL_DOCUMENTS[doc] ?? LEGAL_DOCUMENTS.vilkar;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: d.title }} />
      <ThemedText style={styles.intro}>{d.intro}</ThemedText>
      {d.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <ThemedText accessibilityRole="header" style={styles.heading}>
            {s.heading}
          </ThemedText>
          {s.body.map((p) => (
            <ThemedText key={p} style={styles.paragraph}>
              {p}
            </ThemedText>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  intro: { fontSize: 18, lineHeight: 26, fontWeight: 600 },
  section: { gap: Spacing.two },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: 700 },
  paragraph: { fontSize: 16, lineHeight: 24 },
});
