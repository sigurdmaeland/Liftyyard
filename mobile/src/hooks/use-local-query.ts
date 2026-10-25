import { useFocusEffect } from 'expo-router';
import { type SQLiteDatabase, useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

type State<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; error: string };

/**
 * Leser fra den lokale databasen hver gang skjermen får fokus, og når reload() kalles.
 * `query` må være stabil (en modulfunksjon eller pakket i useCallback).
 */
export function useLocalQuery<T>(query: (db: SQLiteDatabase) => Promise<T>) {
  const db = useSQLiteContext();
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      query(db)
        .then((data) => active && setState({ status: 'ready', data }))
        .catch((e: unknown) => active && setState({ status: 'error', error: String(e) }));
      return () => {
        active = false;
      };
      // version er med med vilje: reload() øker den slik at spørringen kjøres på nytt.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, query, version]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
