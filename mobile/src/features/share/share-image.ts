import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import type { ShareCardRef } from '@/features/share/share-card';

/** Tar bilde av et kort på skjermen og åpner telefonens delingsark (Instagram, Meldinger, …). */
export async function shareViewAsImage(ref: RefObject<ShareCardRef | null>, title: string) {
  try {
    if (!ref.current) return;
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Deling er ikke tilgjengelig på denne enheten');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title, UTI: 'public.png' });
  } catch {
    Alert.alert('Kunne ikke lage bildet', 'Prøv igjen.');
  }
}
