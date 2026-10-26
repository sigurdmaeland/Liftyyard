import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Alert } from 'react-native';

import { toCsv } from '@/lib/export';
import { listExportRows } from '@/storage/export-store';

/** Lager en CSV med alle fullførte sett og åpner delingsarket (lagre i Filer, send på e-post …). */
export async function exportWorkoutsCsv(db: SQLiteDatabase) {
  const rows = await listExportRows(db);
  if (rows.length === 0) {
    Alert.alert('Ingenting å eksportere ennå', 'Fullfør en økt først, så kommer settene med i filen.');
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    Alert.alert('Deling er ikke tilgjengelig på denne enheten');
    return;
  }
  const file = new File(Paths.cache, `liftyard-okter-${new Date().toISOString().slice(0, 10)}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(toCsv(rows));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Eksporter økter' });
}
