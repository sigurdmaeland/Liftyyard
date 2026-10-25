import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Utvider app.json. Google-innlogging trenger en URL-adresse avledet av iOS-klient-ID-en fra Google Cloud,
 * så den legges bare til når EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID er satt i mobile/.env (se docs/auth.md).
 * Klient-ID-er er offentlige identifikatorer, ikke hemmeligheter.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];
  if (iosClientId) {
    const prefix = iosClientId.replace('.apps.googleusercontent.com', '');
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${prefix}` }]);
  }
  return { ...config, name: config.name ?? 'Liftyard', slug: config.slug ?? 'liftyard', plugins };
};
