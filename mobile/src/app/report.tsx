import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { uuidv7 } from '@/lib/ids';
import { REPORT_REASONS, type ReportReason, type ReportTarget, TARGET_LABELS, sendReport } from '@/services/safety';
import { MaxContentWidth, Radius, Spacing } from '@/theme';

/**
 * Rapportering: velg grunn, skriv eventuelt litt mer, send. Den som rapporteres får ikke vite
 * hvem som rapporterte. Etterpå tilbys blokkering når det gjelder en person.
 */
export default function ReportScreen() {
  const { targetType, targetId, username } = useLocalSearchParams<{ targetType: ReportTarget; targetId: string; username?: string }>();
  const theme = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  // Samme ID ved nye forsøk, så en rapport aldri sendes dobbelt.
  const reportId = useRef(uuidv7()).current;
  const what = TARGET_LABELS[targetType] ?? 'innholdet';

  const send = async () => {
    if (!reason) return;
    setState('sending');
    setError(null);
    try {
      await sendReport({ id: reportId, targetType, targetId, reason, details: details.trim() || null });
      setState('sent');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Kunne ikke sende. Har du nett?');
    }
  };

  if (state === 'sent') {
    return (
      <ThemedView style={[styles.fill, styles.done]}>
        <Stack.Screen options={{ title: 'Takk' }} />
        <Icon name="checkmark.circle.fill" size={56} color={theme.success} fallback="✓" />
        <ThemedText accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.doneTitle}>
          Takk for at du sier fra
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.doneText}>
          En moderator ser på rapporten. Den du rapporterte får ikke vite at det var deg.
        </ThemedText>
        {username && (
          <ThemedText themeColor="textSecondary" style={styles.doneText}>
            Vil du slippe å se @{username}? Du kan blokkere brukeren fra profilen.
          </ThemedText>
        )}
        <Button label="Ferdig" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: `Rapporter ${what}` }} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText accessibilityRole="header" style={styles.title}>
            Hva er galt med {what}?
          </ThemedText>
          <View accessibilityRole="radiogroup" style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
            {REPORT_REASONS.map((r, i) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={r.label}
                  accessibilityHint={r.hint}
                  style={[styles.reason, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                  <View style={styles.flex}>
                    <ThemedText style={selected && styles.bold}>{r.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {r.hint}
                    </ThemedText>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.textSecondary }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="smallBold">Vil du fortelle mer? (valgfritt)</ThemedText>
          <TextInput
            value={details}
            onChangeText={setDetails}
            multiline
            maxLength={1000}
            placeholder="Beskriv kort hva som skjedde"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Mer om rapporten, valgfritt"
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {reason === 'SELF_HARM' && (
            <ThemedText type="small" themeColor="textSecondary">
              Er noen i fare nå, ring 113. Mental Helse sin hjelpetelefon er åpen hele døgnet på 116 123.
            </ThemedText>
          )}
          {error && (
            <ThemedText accessibilityRole="alert" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          )}
          <Button label="Send rapport" onPress={send} disabled={!reason} loading={state === 'sending'} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: 700 },
  list: { borderRadius: Radius.large, paddingHorizontal: Spacing.three },
  reason: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56, paddingVertical: Spacing.two },
  flex: { flex: 1 },
  bold: { fontWeight: 700 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  input: { minHeight: 100, borderRadius: Radius.medium, padding: Spacing.three, fontSize: 16, textAlignVertical: 'top' },
  done: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  doneTitle: { fontSize: 22, fontWeight: 700, textAlign: 'center' },
  doneText: { textAlign: 'center' },
});
