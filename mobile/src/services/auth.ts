import { deleteRequest, postJson } from '@/services/api';
import type { AuthResponse } from '@/services/auth-session';

export function startEmailLogin(email: string): Promise<void> {
  return postJson('/api/auth/email/start', { email });
}

export function verifyEmailLogin(email: string, code: string): Promise<AuthResponse> {
  return postJson('/api/auth/email/verify', { email, code });
}

export function loginWithGoogleToken(idToken: string): Promise<AuthResponse> {
  return postJson('/api/auth/google', { idToken });
}

export function logoutRemote(refreshToken: string): Promise<void> {
  return postJson('/api/auth/logout', { refreshToken });
}

/** Bare lokal utvikling: flytter data fra utviklingsbrukeren til kontoen (404 ellers). */
export function claimDevData(): Promise<{ workouts: number }> {
  return postJson('/api/auth/claim-dev-data');
}

export function deleteAccountRemote(): Promise<void> {
  return deleteRequest('/api/me');
}
