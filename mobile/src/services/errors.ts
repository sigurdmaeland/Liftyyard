import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { postJson } from '@/services/api';

/** Sender en uventet feil til serveren (stille; feiler rapporteringen, skjer ingenting). */
export function reportError(error: unknown, screen?: string) {
  const e = error instanceof Error ? error : new Error(String(error));
  postJson('/api/client-errors', {
    message: e.message.slice(0, 500) || 'Ukjent feil',
    stack: e.stack?.slice(0, 4000) ?? null,
    screen: screen ?? null,
    appVersion: Constants.expoConfig?.version ?? null,
    platform: `${Platform.OS} ${Platform.Version}`,
  }).catch(() => {});
}
