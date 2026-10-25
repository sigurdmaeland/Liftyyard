import { deleteRequest, getJson, postJson, putJson } from '@/services/api';
import type { UserSummary } from '@/services/social';
import type { ServerProfile } from '@/storage/profile-store';

/** Hva som kan rapporteres. */
export type ReportTarget = 'USER' | 'WORKOUT' | 'COMMENT' | 'PROGRAM' | 'ROUTINE';

export type ReportReason = 'SPAM' | 'HARASSMENT' | 'HATE' | 'NUDITY' | 'VIOLENCE' | 'SELF_HARM' | 'IMPERSONATION' | 'MISINFORMATION' | 'OTHER';

/** Rekkefølgen og tekstene i rapporteringsskjemaet. */
export const REPORT_REASONS: { value: ReportReason; label: string; hint: string }[] = [
  { value: 'SPAM', label: 'Spam eller reklame', hint: 'Uønsket reklame, svindel eller gjentatte meldinger' },
  { value: 'HARASSMENT', label: 'Trakassering eller mobbing', hint: 'Plager, truer eller henger ut noen' },
  { value: 'HATE', label: 'Hat eller diskriminering', hint: 'Angriper noen for hvem de er' },
  { value: 'NUDITY', label: 'Nakenhet eller seksuelt innhold', hint: 'Bilder eller tekst som ikke hører hjemme her' },
  { value: 'VIOLENCE', label: 'Vold eller farlig adferd', hint: 'Trusler, vold eller farlige utfordringer' },
  { value: 'SELF_HARM', label: 'Selvskading eller spiseforstyrrelser', hint: 'Innhold som kan skade noen som har det vanskelig' },
  { value: 'IMPERSONATION', label: 'Utgir seg for å være noen andre', hint: 'Falsk profil eller stjålet identitet' },
  { value: 'MISINFORMATION', label: 'Farlige trenings- eller helseråd', hint: 'Råd som kan føre til skade' },
  { value: 'OTHER', label: 'Noe annet', hint: 'Beskriv kort hva som er galt' },
];

export const TARGET_LABELS: Record<ReportTarget, string> = {
  USER: 'profilen',
  WORKOUT: 'økten',
  COMMENT: 'kommentaren',
  PROGRAM: 'programmet',
  ROUTINE: 'rutinen',
};

/** Sender en rapport. id lages av appen, så et nytt forsøk etter nettverksfeil ikke gir dobbel rapport. */
export async function sendReport(r: { id: string; targetType: ReportTarget; targetId: string; reason: ReportReason; details: string | null }) {
  await postJson('/api/reports', r);
}

export async function blockUser(username: string): Promise<void> {
  await putJson(`/api/users/${encodeURIComponent(username)}/block`, {});
}

export function unblockUser(username: string): Promise<void> {
  return deleteRequest(`/api/users/${encodeURIComponent(username)}/block`);
}

export function fetchBlockedUsers(): Promise<UserSummary[]> {
  return getJson<UserSummary[]>('/api/me/blocks');
}

export function acceptTerms(version: string): Promise<ServerProfile> {
  return putJson<ServerProfile>('/api/me/terms', { version, confirmsMinimumAge: true });
}

// ---------- Moderering ----------

export type ModerationAction = 'DISMISS' | 'REMOVE_CONTENT' | 'SUSPEND_USER';

export type ReportItem = {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetUserId: string | null;
  targetUsername: string | null;
  targetDisplayName: string | null;
  targetSuspended: boolean;
  reason: ReportReason;
  details: string | null;
  snapshot: string | null;
  reporterUsername: string | null;
  createdAt: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  action: ModerationAction | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  openReportsOnTarget: number;
};

export function fetchReports(status: ReportItem['status']): Promise<ReportItem[]> {
  return getJson<ReportItem[]>(`/api/moderation/reports?status=${status}`);
}

export async function resolveReport(id: string, action: ModerationAction, note: string | null): Promise<void> {
  await postJson(`/api/moderation/reports/${id}/resolve`, { action, note });
}

export function unsuspendUser(userId: string): Promise<void> {
  return deleteRequest(`/api/moderation/users/${userId}/suspension`);
}
