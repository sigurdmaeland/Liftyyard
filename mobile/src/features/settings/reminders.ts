import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { type Reminder, WEEKDAY_NAMES, parseReminders, toExpoWeekday } from '@/lib/reminders';

/*
 * Treningspåminnelser som lokale varsler, gjentatt hver uke på valgte dager og klokkeslett.
 * Ingen server: telefonen planlegger dem selv, så de kommer også uten nett. Valgene lagres på
 * telefonen og overlever utlogging.
 */

const KEY = 'training_reminders';
const MESSAGES = ['På tide med økt! 💪', 'Klar for dagens økt?', 'Vektene venter. Ses på senteret!', 'Én økt nærmere målet ditt.'];
const listeners = new Set<() => void>();
let current: Reminder[] = load();

function load(): Reminder[] {
  try {
    return parseReminders(Storage.getItemSync(KEY));
  } catch {
    return parseReminders(null);
  }
}

const identifier = (weekday: number) => `training-reminder-${weekday}`;

/** Ber om lov til varsler (første gang). false hvis brukeren har sagt nei. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
  return asked.granted;
}

/** Fjerner gamle varsler for dagen og planlegger på nytt hvis den er slått på. */
async function schedule(r: Reminder) {
  await Notifications.cancelScheduledNotificationAsync(identifier(r.weekday)).catch(() => {});
  if (!r.enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: identifier(r.weekday),
    content: { title: 'Treningspåminnelse', body: MESSAGES[r.weekday % MESSAGES.length], sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: toExpoWeekday(r.weekday), hour: r.hour, minute: r.minute },
  });
}

/** Lagrer én dag og planlegger varselet på nytt. */
export async function updateReminder(next: Reminder) {
  current = current.map((r) => (r.weekday === next.weekday ? next : r));
  try {
    Storage.setItemSync(KEY, JSON.stringify(current));
  } catch {
    // Varselet planlegges uansett; bare visningen glemmer valget ved neste oppstart.
  }
  listeners.forEach((l) => l());
  await schedule(next);
}

export function useReminders(): Reminder[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export { WEEKDAY_NAMES };
