import * as Notifications from 'expo-notifications';

/*
 * Lokalt varsel når hvilen er over, slik at det virker også når appen er i bakgrunnen eller
 * skjermen er låst. Ingen server eller push er involvert. Når appen er åpen viser hviletimer-
 * linjen og vibrasjonen beskjeden, så varselet vises ikke da.
 */

let scheduledId: string | null = null;
let permission: 'unknown' | 'granted' | 'denied' = 'unknown';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

async function allowed(): Promise<boolean> {
  if (permission !== 'unknown') return permission === 'granted';
  try {
    const current = await Notifications.getPermissionsAsync();
    const status = current.granted ? current : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    permission = status.granted ? 'granted' : 'denied';
  } catch {
    permission = 'denied';
  }
  return permission === 'granted';
}

/** Planlegger varselet (og fjerner et tidligere). endsAt = null fjerner det. */
export async function scheduleRestNotification(endsAt: number | null) {
  try {
    if (scheduledId) {
      await Notifications.cancelScheduledNotificationAsync(scheduledId);
      scheduledId = null;
    }
    if (endsAt === null) return;
    const seconds = Math.round((endsAt - Date.now()) / 1000);
    if (seconds < 2 || !(await allowed())) return;
    scheduledId = await Notifications.scheduleNotificationAsync({
      content: { title: 'Hvilen er over', body: 'Klar for neste sett 💪', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {
    // Varsler er et tillegg; hviletimeren i appen virker uansett.
  }
}
