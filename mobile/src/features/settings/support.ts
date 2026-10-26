import Constants from 'expo-constants';

/** Appens versjon (fra app.json), vist i Innstillinger og sendt med tilbakemeldinger. */
export const APP_VERSION = Constants.expoConfig?.version ?? '–';
