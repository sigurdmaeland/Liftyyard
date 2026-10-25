import Constants, { ExecutionEnvironment } from 'expo-constants';

/*
 * «Fortsett med Google» bruker en innebygd modul som ikke finnes i Expo Go, bare i appens egen
 * utviklerversjon (npx expo run:ios). Klient-ID-ene er offentlige (ikke hemmeligheter) og settes i
 * mobile/.env, se docs/auth.md.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

export const googleSignInAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && WEB_CLIENT_ID !== '' && IOS_CLIENT_ID !== '';

/** Åpner Googles innlogging og returnerer ID-tokenet, eller null hvis brukeren avbrøt. */
export async function getGoogleIdToken(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    // Vi trenger bare ID-tokenet; Google-økten på telefonen avsluttes så neste innlogging kan velge konto.
    const token = response.data.idToken;
    await GoogleSignin.signOut().catch(() => {});
    return token;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return null;
    throw e;
  }
}
