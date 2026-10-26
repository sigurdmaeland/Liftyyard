import { useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Spacing } from '@/theme';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Hvordan starter jeg en økt?',
    a: 'Trykk «Start ny økt» på Hjem for en tom økt, eller «Start» på en rutine i Bibliotek. Økten lagres fortløpende, så du kan lukke appen og fortsette senere.',
  },
  {
    q: 'Virker appen uten nett?',
    a: 'Ja. Alt du logger lagres på telefonen først og sendes til kontoen din når du har nett igjen. Under Innstillinger → Synkroniser treningsdata ser du om noe venter.',
  },
  {
    q: 'Hvem kan se øktene mine?',
    a: 'Som standard følgerne dine. Du kan velge for hver økt når du fullfører den, endre standarden under Innstillinger → Kontopersonvern, eller gjøre hele profilen privat.',
  },
  {
    q: 'Hvordan regnes rekordene (medaljene)?',
    a: 'Vi følger tre rekorder per øvelse: estimert 1RM (Epley-formelen), tyngste vekt og største settvolum (vekt × reps). Et sett som havner blant dine tre beste får gull, sølv eller bronse. Første gang du logger en øvelse, gis det ingen medalje.',
  },
  {
    q: 'Hvordan lager jeg et supersett?',
    a: 'Under økten åpner du menyen på en øvelse og velger «Supersett med …» for å koble den til neste øvelse. Hviletimeren starter da først etter siste øvelse i supersettet.',
  },
  {
    q: 'Kan jeg bytte mellom kg og lb?',
    a: 'Ja, under Innstillinger → Enheter. Alt lagres i kg, så du kan bytte fram og tilbake uten at noe går tapt.',
  },
  {
    q: 'Hvordan deler jeg et program?',
    a: 'Åpne programmet, trykk ⋯ → Rediger program og velg hvem som kan se det under «Deling». Delte programmer kan finnes og kopieres i Utforsk.',
  },
  {
    q: 'Hva skjer når noen kopierer programmet mitt?',
    a: 'De får sin egen kopi som de kan endre fritt. Kopien viser alltid at den er basert på ditt program, og du får et varsel.',
  },
  {
    q: 'Hvordan får jeg ut dataene mine?',
    a: 'Under Innstillinger → Eksporter data får du alle settene dine som et regneark (CSV) som kan åpnes i Excel, Numbers eller Google Regneark.',
  },
  {
    q: 'Hvordan sletter jeg kontoen?',
    a: 'Nederst i Innstillinger. Kontoen og alt innhold (økter, programmer, bilder og målinger) slettes permanent og kan ikke gjenopprettes.',
  },
];

/** Ofte stilte spørsmål. Trykk på et spørsmål for å se svaret. */
export default function FaqScreen() {
  const theme = useTheme();
  const [open, setOpen] = useState<number | null>(null);
  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => (o === i ? null : i));
  };
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {FAQ.map((item, i) => {
        const expanded = open === i;
        return (
          <View key={item.q} style={[styles.item, { borderBottomColor: theme.backgroundSelected }]}>
            <Pressable
              onPress={() => toggle(i)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              style={({ pressed }) => [styles.question, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={styles.q}>{item.q}</ThemedText>
              <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={14} color={theme.textSecondary} fallback={expanded ? '˄' : '˅'} />
            </Pressable>
            {expanded && <ThemedText style={styles.a}>{item.a}</ThemedText>}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  item: { borderBottomWidth: StyleSheet.hairlineWidth },
  question: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 60, paddingVertical: Spacing.three },
  q: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: 600 },
  a: { fontSize: 16, lineHeight: 23, paddingBottom: Spacing.three },
});
