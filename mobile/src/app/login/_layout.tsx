import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/services/auth-session';

/** Innlogging: velkomstskjerm og e-post med kode. */
export default function LoginLayout() {
  const auth = useAuth();
  if (auth.status === 'signedIn') return <Redirect href="/" />;
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="email" options={{ title: '', headerTransparent: true }} />
    </Stack>
  );
}
