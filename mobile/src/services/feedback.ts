import { Platform } from 'react-native';

import { APP_VERSION } from '@/features/settings/support';
import { uuidv7 } from '@/lib/ids';
import { getJson, postJson } from '@/services/api';

export type FeedbackKind = 'BUG' | 'IDEA' | 'SUPPORT';

export type FeedbackItem = {
  id: string;
  kind: FeedbackKind;
  message: string;
  appVersion: string | null;
  platform: string | null;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  userId: string;
  username: string | null;
  displayName: string;
};

/** Sender en tilbakemelding fra «Få hjelp». Appversjon og system følger med; ingen andre opplysninger. */
export function sendFeedback(kind: FeedbackKind, message: string, id = uuidv7()): Promise<void> {
  return postJson('/api/feedback', { id, kind, message, appVersion: APP_VERSION, platform: `${Platform.OS} ${String(Platform.Version)}` });
}

export function fetchFeedback(status: 'OPEN' | 'DONE'): Promise<FeedbackItem[]> {
  return getJson<FeedbackItem[]>(`/api/moderation/feedback?status=${status}`);
}

export function markFeedbackDone(id: string): Promise<void> {
  return postJson(`/api/moderation/feedback/${id}/done`);
}
