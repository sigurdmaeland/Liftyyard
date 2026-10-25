import { useEffect, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatDuration } from '@/lib/format';

/** Teller opp fra `since` og oppdateres hvert sekund. */
export function ElapsedTime({ since, style }: { since: string; style?: StyleProp<TextStyle> }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = (now - new Date(since).getTime()) / 1000;
  return <ThemedText style={[{ fontVariant: ['tabular-nums'] }, style]}>{formatDuration(seconds)}</ThemedText>;
}
