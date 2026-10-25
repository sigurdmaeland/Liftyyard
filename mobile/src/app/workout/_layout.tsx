import { Stack } from 'expo-router';

import { ToastHost } from '@/components/toast';

/**
 * Navigasjon inne i en aktiv økt. Hele økten vises i fullskjerm uten fanelinje.
 * Menyer åpnes som native ark (formSheet), og øvelser logges på egne skjermer.
 */
export default function WorkoutLayout() {
  const sheet = {
    presentation: 'formSheet',
    headerShown: false,
    sheetGrabberVisible: true,
    sheetAllowedDetents: 'fitToContents',
  } as const;
  return (
    <>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        <Stack.Screen name="exercise-info" options={{ title: 'Øvelse' }} />
        <Stack.Screen name="finish" options={{ title: 'Fullfør økt' }} />
        <Stack.Screen name="add-exercise" options={{ presentation: 'modal', title: 'Velg øvelse' }} />
        <Stack.Screen name="more" options={sheet} />
        <Stack.Screen name="exercise-menu" options={sheet} />
        <Stack.Screen name="rest" options={sheet} />
      <Stack.Screen name="plates" options={sheet} />
        <Stack.Screen name="notes" options={{ ...sheet, sheetAllowedDetents: [0.6] }} />
      </Stack>
      {/* Økten er en egen fullskjerm, så meldinger (f.eks. ny rekord) må vises her også. */}
      <ToastHost />
    </>
  );
}
