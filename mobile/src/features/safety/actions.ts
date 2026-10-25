import { router } from 'expo-router';
import { Alert } from 'react-native';

import { type ReportTarget, blockUser, unblockUser } from '@/services/safety';

/** Åpner rapporteringsskjemaet. username tas med for å tilby blokkering etterpå. */
export function openReport(targetType: ReportTarget, targetId: string, username?: string | null) {
  router.push({ pathname: '/report', params: { targetType, targetId, ...(username ? { username } : {}) } });
}

/** Spør før blokkering og forklarer hva som skjer. onDone kalles etter at blokkeringen er lagret. */
export function confirmBlock(username: string, onDone: () => void) {
  Alert.alert(
    `Blokkere @${username}?`,
    'Dere slutter å følge hverandre og ser ikke lenger hverandres profil, økter, kommentarer eller delte programmer. Brukeren får ikke beskjed. Du kan oppheve blokkeringen i Innstillinger.',
    [
      { text: 'Avbryt', style: 'cancel' },
      {
        text: 'Blokker',
        style: 'destructive',
        onPress: () =>
          blockUser(username)
            .then(onDone)
            .catch((e: unknown) => Alert.alert('Kunne ikke blokkere', e instanceof Error ? e.message : 'Prøv igjen når du har nett.')),
      },
    ],
  );
}

export function confirmUnblock(username: string, onDone: () => void) {
  Alert.alert(`Oppheve blokkeringen av @${username}?`, 'Dere kan se hverandre igjen. Følging må startes på nytt.', [
    { text: 'Avbryt', style: 'cancel' },
    {
      text: 'Opphev',
      onPress: () =>
        unblockUser(username)
          .then(onDone)
          .catch((e: unknown) => Alert.alert('Kunne ikke oppheve', e instanceof Error ? e.message : 'Prøv igjen når du har nett.')),
    },
  ]);
}
